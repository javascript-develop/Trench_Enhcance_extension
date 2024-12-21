const config = {
    WHOISXML_API_KEYS: [
        '',
        '',
        ''
    ],
    TWITTER_BEARER_TOKEN: ''
};

class TwitterChecker {
    constructor(bearerToken) {
        this.bearerToken = bearerToken;
        this.userCache = new Map();
    }

    extractUsernameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === 'twitter.com' || urlObj.hostname === 'x.com') {
                const username = urlObj.pathname.split('/')[1];
                return username.replace('@', '');
            }
        } catch (e) {
            console.error('Error parsing Twitter URL:', e);
        }
        return null;
    }

    async getUserInfo(username) {
        if (this.userCache.has(username)) {
            return this.userCache.get(username);
        }

        try {
            const twitterApiUrl = `https://api.twitter.com/2/users/by/username/${username}?user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,public_metrics,url,username,verified,verified_type,withheld`;

            const userData = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'FETCH_TWITTER',
                    url: twitterApiUrl,
                    headers: {
                        'Authorization': `Bearer ${this.bearerToken}`,
                        'Accept': 'application/json'
                    }
                }, response => {
                    if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response.data);
                    }
                });
            });

            if (userData.data?.id) {
                const tweetApiUrl = `https://api.twitter.com/2/users/${userData.data.id}/tweets?max_results=100&tweet.fields=created_at`;
                
                const tweetsData = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        type: 'FETCH_TWITTER',
                        url: tweetApiUrl,
                        headers: {
                            'Authorization': `Bearer ${this.bearerToken}`,
                            'Accept': 'application/json'
                        }
                    }, response => {
                        if (response.error) {
                            reject(new Error(response.error));
                        } else {
                            resolve(response.data);
                        }
                    });
                });

                const usernameChanges = this.detectUsernameChanges(tweetsData.data || []);
                userData.usernameHistory = usernameChanges;
            }

            this.userCache.set(username, userData);
            return userData;
        } catch (error) {
            console.error('Error fetching Twitter user info:', error);
            return null;
        }
    }

    detectUsernameChanges(tweets) {
        const changes = [];
        const usernameChangeRegex = /changed\s+(?:my\s+)?username\s+(?:from|to)\s+@?(\w+)/i;
        const previouslyKnownRegex = /previously\s+@?(\w+)/i;

        for (const tweet of tweets) {
            const changeMatch = tweet.text.match(usernameChangeRegex);
            const previousMatch = tweet.text.match(previouslyKnownRegex);

            if (changeMatch || previousMatch) {
                changes.push({
                    date: tweet.created_at,
                    username: (changeMatch || previousMatch)[1],
                    tweet: tweet.text
                });
            }
        }

        return changes;
    }

    isRecycledUsername(userData) {
        if (!userData?.data) return false;

        const accountAge = new Date() - new Date(userData.data.created_at);
        const daysOld = accountAge / (1000 * 60 * 60 * 24);

        const suspiciousPatterns = {
            recentlyCreated: daysOld < 30,
            lowTweetCount: userData.data.public_metrics?.tweet_count < 10,
            noProfileImage: userData.data.profile_image_url?.includes('default_profile'),
            defaultProfile: userData.data.profile_image_url?.includes('default'),
            suspiciousDescription: !userData.data.description || userData.data.description.length < 10
        };

        let suspicionScore = 0;
        Object.values(suspiciousPatterns).forEach(isTrue => {
            if (isTrue) suspicionScore++;
        });

        return {
            isLikelyRecycled: suspicionScore >= 3,
            suspicionScore,
            patterns: suspiciousPatterns,
            created_at: userData.data.created_at
        };
    }
}

class TokenEnhancer {
    constructor() {
        this.searchTerms = [];
        this.blacklist = new Set();
        this.searchHistory = [];
        this.insertionAttempts = 0;
        this.MAX_ATTEMPTS = 10;
        this.HISTORY_KEY = 'tokenSearch_history';
        this.BLACKLIST_KEY = 'tokenSearch_blacklist';
        this.currentTokenAddress = null;
        this.isInitialized = false;
        this.usedApiKeys = new Set();
        this.twitterChecker = new TwitterChecker(config.TWITTER_BEARER_TOKEN);
        
        this.init();

        window.addEventListener('popstate', () => this.handleNavigation());
        window.addEventListener('pushstate', () => this.handleNavigation());
        window.addEventListener('replacestate', () => this.handleNavigation());
    }

    getRandomApiKey() {
        const availableKeys = config.WHOISXML_API_KEYS.filter(key => !this.usedApiKeys.has(key));
        if (availableKeys.length === 0) {
            this.usedApiKeys.clear();
            return config.WHOISXML_API_KEYS[Math.floor(Math.random() * config.WHOISXML_API_KEYS.length)];
        }
        const randomIndex = Math.floor(Math.random() * availableKeys.length);
        const selectedKey = availableKeys[randomIndex];
        this.usedApiKeys.add(selectedKey);
        return selectedKey;
    }

    async init() {
        await this.loadBlacklist();
        await this.loadSearchHistory();
        this.setupObserver();
        this.processInitialElements();
    }
    

    handleNavigation() {
        this.insertionAttempts = 0;
        this.isInitialized = false;

        if (!window.location.pathname.includes('/terminal')) {
            this.currentTokenAddress = null;
        }

        this.setupControlsInsertion();
        this.processInitialElements();
    }

    processInitialElements() {
        const existingCards = document.querySelectorAll('.pump-card');
        console.log('Found existing cards:', existingCards.length);
        existingCards.forEach(card => {
            this.addSecurityIcon(card);
        });

        if (window.location.pathname.includes('/terminal')) {
            const urlParams = new URLSearchParams(window.location.search);
            const address = urlParams.get('address');
            if (address) {
                this.currentTokenAddress = address;
                this.checkForTokenPageSocialLinks();
            }
        }

        this.setupControlsInsertion();
    }

    async loadBlacklist() {
        const savedBlacklist = localStorage.getItem(this.BLACKLIST_KEY);
        if (savedBlacklist) {
            this.blacklist = new Set(savedBlacklist.split('\n').map(term => term.trim().toLowerCase()).filter(term => term !== ''));
        }
    }

    async loadSearchHistory() {
        const savedHistory = localStorage.getItem(this.HISTORY_KEY);
        if (savedHistory) {
            this.searchHistory = JSON.parse(savedHistory);
        }
    }

    setupControlsInsertion() {
        const insertInterval = setInterval(() => {
            if (this.insertionAttempts >= this.MAX_ATTEMPTS) {
                clearInterval(insertInterval);
                return;
            }

            if (this.createSearchControls()) {
                clearInterval(insertInterval);
            } else {
                this.insertionAttempts++;
            }
        }, 500);
    }

    createSearchControls() {
        const isPhoton = window.location.hostname.includes('tinyastro');
        const isNeo = window.location.hostname === 'neo.bullx.io';
        const isPumpVision = window.location.pathname.includes('pump-vision');

        let targetElement;
        if (isPhoton) {
            targetElement = [...document.querySelectorAll('div')].find(el => el.textContent === 'Presets');
        } else if (isNeo) {
            targetElement = document.querySelector('.inline-flex.gap-2.items-center') || 
                          document.querySelector('.neo-vision-header');
        } else if (isPumpVision) {
            targetElement = document.querySelector('.explore-header .flex.items-center.gap-x-2');
        }

        if (!targetElement) {
            console.log('Target element not found for search controls');
            return false;
        }

        const container = document.createElement('div');
        container.className = 'search-container';

        if (isPhoton) {
            container.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 0 10px;
                background: rgba(26, 27, 35, 0.8);
                padding: 4px;
                border-radius: 44px;
            `;
        } else if (isPumpVision || isNeo) {
            container.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                margin-right: 8px;
                height: 36px;
            `;
        }

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search tokens...';
        
        if (isPhoton) {
            searchInput.className = 'custom-search-input';
            searchInput.style.cssText = `
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                color: #fff;
                font-size: 14px;
                padding: 8px 16px;
                width: 200px;
                outline: none;
                transition: all 0.3s ease;
            `;
        } else {
            searchInput.className = 'ant-input-number-input bg-grey-700 text-grey-200 rounded px-3 h-[36px] w-[200px] outline-none border border-grey-500';
        }

        const buttonClass = isPhoton ? 'control-button' : 
            'ant-btn ant-btn-default !bg-grey-700 h-[36px] text-grey-200 px-3 rounded border border-grey-500 hover:!border-grey-400 hover:!bg-grey-600';

        const blacklistButton = document.createElement('button');
        blacklistButton.className = buttonClass;
        blacklistButton.textContent = 'Blacklist';
        
        if (isPhoton) {
            blacklistButton.style.cssText = `
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 20px;
                color: #fff;
                font-size: 14px;
                padding: 8px 16px;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
        }

        const historyButton = document.createElement('button');
        historyButton.className = buttonClass;
        historyButton.textContent = 'History';
        
        if (isPhoton) {
            historyButton.style.cssText = blacklistButton.style.cssText;
        }

        const blacklistModal = this.createModal('blacklist');
        const historyModal = this.createModal('history');

        searchInput.addEventListener('input', () => {
            const rawInput = searchInput.value;
            this.searchTerms = rawInput
                .split(',')
                .map(term => term.trim().toLowerCase())
                .filter(term => term !== '');

            if (isPhoton) {
                this.filterPhotonRows();
            } else {
                this.filterRows();
            }
            this.updateSearchHistory(rawInput);
        });

        blacklistButton.addEventListener('click', () => blacklistModal.show());
        historyButton.addEventListener('click', () => historyModal.show());

        container.appendChild(searchInput);
        container.appendChild(blacklistButton);
        container.appendChild(historyButton);

        if (isPhoton) {
            targetElement.parentNode.insertBefore(container, targetElement);
        } else if (isNeo) {
            targetElement.insertBefore(container, targetElement.firstChild);
        } else if (isPumpVision) {
            targetElement.insertBefore(container, targetElement.firstChild);
        }

        return true;
    }

    createModal(type) {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'modal-backdrop';

        const modal = document.createElement('div');
        modal.className = 'modal';

        const title = document.createElement('div');
        title.className = 'modal-title';
        title.textContent = type === 'blacklist' ? 'Blacklist Settings' : 'Search History';

        const content = type === 'blacklist'
            ? this.createBlacklistContent()
            : this.createHistoryContent();

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-buttons';

        const closeButton = document.createElement('button');
        closeButton.className = 'modal-button';
        closeButton.textContent = 'Close';

        buttonContainer.appendChild(closeButton);
        modal.appendChild(title);
        modal.appendChild(content);
        modal.appendChild(buttonContainer);

        document.body.appendChild(modalBackdrop);
        document.body.appendChild(modal);

        const close = () => {
            modal.style.display = 'none';
            modalBackdrop.style.display = 'none';
        };

        modalBackdrop.addEventListener('click', close);
        closeButton.addEventListener('click', close);

        return {
            show: () => {
                if (type === 'history') {
                    this.updateHistoryContent(content);
                }
                modal.style.display = 'block';
                modalBackdrop.style.display = 'block';
            }
        };
    }

    createBlacklistContent() {
        const container = document.createElement('div');
        const textarea = document.createElement('textarea');
        textarea.className = 'blacklist-textarea';
        textarea.value = Array.from(this.blacklist).join('\n');

        const saveButton = document.createElement('button');
        saveButton.className = 'modal-button save';
        saveButton.textContent = 'Save';
        saveButton.onclick = () => {
            this.blacklist = new Set(textarea.value.split('\n').map(term => term.trim().toLowerCase()).filter(term => term !== ''));
            localStorage.setItem(this.BLACKLIST_KEY, Array.from(this.blacklist).join('\n'));
            this.filterRows();
            saveButton.closest('.modal').style.display = 'none';
            saveButton.closest('.modal').previousElementSibling.style.display = 'none';
        };

        container.appendChild(textarea);
        container.appendChild(saveButton);
        return container;
    }

    createHistoryContent() {
        const container = document.createElement('div');
        container.className = 'history-list';
        return container;
    }

    updateHistoryContent(container) {
        container.innerHTML = '';
        this.searchHistory.forEach(item => {
            const listItem = document.createElement('div');
            listItem.className = 'history-item';
            listItem.textContent = item;
            listItem.onclick = () => {
                this.applySearchFromHistory(item);
                listItem.closest('.modal').style.display = 'none';
                listItem.closest('.modal').previousElementSibling.style.display = 'none';
            };
            container.appendChild(listItem);
        });
    }

    setupObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.classList?.contains('pump-card')) {
                            this.addSecurityIcon(node);
                        }

                        if (node.querySelectorAll) {
                            const cardsInNode = node.querySelectorAll('.pump-card');
                            cardsInNode.forEach(card => this.addSecurityIcon(card));
                        }
                    });

                    this.filterRows();

                    if (this.currentTokenAddress) {
                        this.checkForTokenPageSocialLinks();
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    setupControlsInsertion() {
        if (this.isInitialized) return;

        const insertInterval = setInterval(() => {
            if (this.insertionAttempts >= this.MAX_ATTEMPTS) {
                clearInterval(insertInterval);
                return;
            }

            if (this.createSearchControls()) {
                clearInterval(insertInterval);
                this.isInitialized = true;
            } else {
                this.insertionAttempts++;
            }
        }, 500);
    }

    checkForTokenPageSocialLinks() {
        const socialLinksContainer = document.querySelector('.flex.flex-row.items-center.order-1.md\\:order-2');
        if (socialLinksContainer && !socialLinksContainer.querySelector('.security-icon')) {
            this.addSecurityIconToHeader(socialLinksContainer);
        }
    }

    findWebsiteLink(allLinks) {
        console.log('All found links:', allLinks.map(a => ({
            href: a.href,
            innerHTML: a.innerHTML
        })));

        const excludedDomains = ['pump.fun', 'twitter.com', 'x.com', 't.me', 'telegram.me', 'solscan.io'];
        const excludedPaths = ['/terminal', '/search'];
        
        const validLinks = allLinks.filter(a => {
            try {
                const url = new URL(a.href);
                const isValidDomain = !excludedDomains.some(domain => url.hostname.includes(domain));
                const isValidPath = !excludedPaths.some(path => url.pathname.startsWith(path));
                return isValidDomain && isValidPath;
            } catch (e) {
                console.error('Invalid URL:', a.href);
                return false;
            }
        });
    
        console.log('Valid links after filtering:', validLinks.map(a => ({
            href: a.href,
            innerHTML: a.innerHTML
        })));
    
        const globeIconLink = validLinks.find(a => {
            const svg = a.querySelector('svg');
            const path = svg?.querySelector('path[fill-rule="evenodd"]');
            const pathContent = path?.getAttribute('d') || '';
            return pathContent.includes('M6 0C2.6862 0 0 2.6862 0 6C0');
        });
    
        return globeIconLink?.href;
    }

    async addSecurityIcon(card) {
        if (card.querySelector('.security-icon')) return;
    
        const containerParent = card.querySelector('.flex.items-center.justify-between.mt-2');
        if (!containerParent) return;
    
        const socialLinksContainer = containerParent.querySelector('div.flex:first-child');
        if (!socialLinksContainer) return;

        const twitterLink = Array.from(socialLinksContainer.querySelectorAll('a')).find(a => 
            a.href.includes('twitter.com') || a.href.includes('x.com')
        );

        const cardLink = card.querySelector('a[href*="/terminal"]');
        const contractAddress = cardLink ? new URLSearchParams(cardLink.href.split('?')[1]).get('address') : null;

        const shieldIconWrapper = document.createElement('a');
        shieldIconWrapper.className = 'leading-none social-link bg-transparent';
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'security-icon flex items-center justify-center p-[0px] overflow-hidden text-grey-300 w-5 h-5 rounded-full bg-grey-500';
        
        iconSpan.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-search" viewBox="0 0 16 16">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
            </svg>
        `;
    
        shieldIconWrapper.appendChild(iconSpan);
        socialLinksContainer.appendChild(shieldIconWrapper);
    
        shieldIconWrapper.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
    
            const tokenName = card.querySelector('.font-medium.text-grey-50')?.textContent;
            const tokenSymbol = card.querySelector('.font-normal.text-grey-200.overflow-ellipsis.line-clamp-1.text-xs')?.textContent || '';

            const allLinks = Array.from(socialLinksContainer.querySelectorAll('a'));
            const websiteLink = this.findWebsiteLink(allLinks);

            this.showSecurityPopup(tokenName, tokenSymbol, websiteLink, null, contractAddress);

            if (twitterLink) {
                const username = this.twitterChecker.extractUsernameFromUrl(twitterLink.href);
                if (username) {
                    const twitterData = await this.twitterChecker.getUserInfo(username);
                    if (twitterData) {
                        this.updatePopupWithTwitterData(twitterData);
                    }
                }
            }
        });
    }

    addSecurityIconToHeader(container) {
        if (container.querySelector('.security-icon')) return;

        const shieldIconWrapper = document.createElement('a');
        shieldIconWrapper.className = 'text-grey-400 hover:text-grey-300 mr-1 bg-transparent cursor-pointer';
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'security-icon w-[12px] h-[12px] flex items-center justify-center p-[0px] overflow-hidden';
        
        iconSpan.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                <path d="M6 11s4-2 4-5V3l-4-1.5L2 3v3c0 3 4 5 4 5z"/>
            </svg>
        `;

        shieldIconWrapper.appendChild(iconSpan);

        const shareButton = container.querySelector('.relative.hover\\:cursor-pointer');
        if (shareButton) {
            container.insertBefore(shieldIconWrapper, shareButton);
        } else {
            container.appendChild(shieldIconWrapper);
        }

        shieldIconWrapper.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const allLinks = Array.from(container.querySelectorAll('a'));
            console.log('All found links:', allLinks.map(a => ({
                href: a.href,
                innerHTML: a.innerHTML
            })));

            const excludedDomains = ['pump.fun', 'twitter.com', 'x.com', 't.me', 'telegram.me', 'solscan.io'];
            const excludedPaths = ['/terminal', '/search'];
            
            const validLinks = allLinks.filter(a => {
                try {
                    const url = new URL(a.href);
                    const isValidDomain = !excludedDomains.some(domain => url.hostname.includes(domain));
                    const isValidPath = !excludedPaths.some(path => url.pathname.startsWith(path));
                    return isValidDomain && isValidPath;
                } catch (e) {
                    console.error('Invalid URL:', a.href);
                    return false;
                }
            });

            console.log('Valid links after filtering:', validLinks.map(a => ({
                href: a.href,
                innerHTML: a.innerHTML
            })));

            let websiteLink;
            const globeIconLink = validLinks.find(a => {
                const svg = a.querySelector('svg');
                const path = svg?.querySelector('path[fill-rule="evenodd"]');
                const pathContent = path?.getAttribute('d') || '';
                return pathContent.includes('M6 0C2.6862 0 0 2.6862 0 6C0');
            });

            if (globeIconLink) {
                websiteLink = globeIconLink.href;
                console.log('Found website link with globe icon:', websiteLink);
            }

            const tokenName = document.querySelector('h1')?.textContent || '';
            const tokenSymbol = document.querySelector('.text-grey-200.text-sm')?.textContent || '';

            await this.showSecurityPopup(tokenName, tokenSymbol, websiteLink);
        });
    }

    truncateAddress(address) {
        if (!address) return 'N/A';
        if (address.length <= 12) return address;
        return `${address.slice(0, 6)}...${address.slice(-6)}`;
    }

    async checkWebsiteContent(websiteUrl, tokenName, tokenSymbol, contractAddress) {
        console.log('Checking website content for:', websiteUrl);
        console.log('Searching for:', { tokenName, tokenSymbol, contractAddress });
    
        try {
            const url = new URL(websiteUrl);
            if (!url.protocol.startsWith('http')) {
                throw new Error('Invalid URL protocol');
            }
    
            const response = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Request timed out'));
                }, 10000);
    
                chrome.runtime.sendMessage({
                    type: 'FETCH_WEBSITE',
                    url: websiteUrl
                }, response => {
                    clearTimeout(timeoutId);
                    
                    if (chrome.runtime.lastError) {
                        console.error('Chrome runtime error:', chrome.runtime.lastError);
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
    
                    if (response.error) {
                        console.error('Response error:', response.error);
                        reject(new Error(response.error));
                        return;
                    }
    
                    resolve(response);
                });
            });
    
            if (!response.data) {
                throw new Error('No website content received');
            }

            const escapeRegExp = (string) => {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            };
    
            const text = response.data.toLowerCase();
            const sanitizedTokenName = tokenName ? escapeRegExp(tokenName.toLowerCase()) : '';
            const sanitizedSymbol = tokenSymbol ? escapeRegExp(tokenSymbol.toLowerCase()) : '';
            const sanitizedCA = contractAddress ? escapeRegExp(contractAddress.toLowerCase()) : '';
    
            const results = {
                hasTokenName: tokenName && new RegExp(sanitizedTokenName).test(text),
                hasTokenSymbol: tokenSymbol && new RegExp(sanitizedSymbol).test(text),
                hasContractAddress: contractAddress && new RegExp(sanitizedCA).test(text)
            };

            const countMatches = (pattern) => {
                try {
                    return pattern ? (text.match(new RegExp(pattern, 'g')) || []).length : 0;
                } catch (e) {
                    console.error('Error counting matches:', e);
                    return 0;
                }
            };
    
            const matches = {
                tokenNameMatches: countMatches(sanitizedTokenName),
                symbolMatches: countMatches(sanitizedSymbol),
                contractMatches: countMatches(sanitizedCA)
            };
    
            console.log('Content verification results:', { results, matches });
    
            return {
                ...results,
                matches,
                tokenName,
                tokenSymbol,
                contractAddress
            };
        } catch (error) {
            console.error('Error in checkWebsiteContent:', error);
            return {
                error: error.message,
                tokenName,
                tokenSymbol,
                contractAddress
            };
        }
    }

    async makeWhoisRequest(hostname) {
        const maxRetries = config.WHOISXML_API_KEYS.length;
        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const apiKey = this.getRandomApiKey();
            const apiUrl = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${hostname}&outputFormat=JSON`;
            
            try {
                console.log(`Attempt ${attempt + 1}/${maxRetries} using API key: ${apiKey.substring(0, 8)}...`);
                const response = await fetch(apiUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const responseText = await response.text();
                
                try {
                    const data = JSON.parse(responseText);

                    if (data.ErrorMessage || data.error) {
                        throw new Error(data.ErrorMessage || data.error);
                    }
                    
                    return data;
                } catch (parseError) {
                    throw new Error('Invalid JSON response');
                }
            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed:`, error);
                lastError = error;
                continue;
            }
        }
        throw new Error(`All API keys failed. Last error: ${lastError.message}`);
    }

    getRecycledUsernameWarning(twitterData) {
        if (!twitterData?.data) return '';
        
        const recycledInfo = this.twitterChecker.isRecycledUsername(twitterData);
        if (!recycledInfo.isLikelyRecycled) return '';
    
        const warningMessages = {
            recentlyCreated: 'Account created within the last 30 days',
            lowTweetCount: 'Very low tweet count',
            noProfileImage: 'Default profile image',
            defaultProfile: 'Default profile settings',
            suspiciousDescription: 'Minimal or missing profile description'
        };
    
        const warnings = Object.entries(recycledInfo.patterns)
            .filter(([_, isTrue]) => isTrue)
            .map(([pattern]) => `<div class="security-info-row warning">${warningMessages[pattern]}</div>`)
            .join('');
    
        return `
            <div class="security-info-section warning-section">
                <div class="security-info-title text-yellow-500">⚠️ Potential Recycled Username Warning</div>
                ${warnings}
            </div>
        `;
    }
    
    getTwitterUsernameHistory(twitterData) {
        if (!twitterData?.usernameHistory?.length) return '';
    
        const historyItems = twitterData.usernameHistory
            .map(change => `
                <div class="security-info-row">
                    <span class="security-info-label">Previous Username:</span>
                    <span class="security-info-value">@${change.username} (${new Date(change.date).toLocaleDateString()})</span>
                </div>
            `)
            .join('');
    
        return `
            <div class="security-info-section">
                <div class="security-info-title">Username History</div>
                ${historyItems}
            </div>
        `;
    }

    updatePopupWithTwitterData(twitterData) {
        const popup = document.querySelector('.security-popup');
        if (!popup) return;
    
        const loadingTwitter = popup.querySelector('#loading-twitter');
        if (loadingTwitter) {
            loadingTwitter.remove();
        }

        if (!twitterData || !twitterData.data) {
            const errorSection = document.createElement('div');
            errorSection.className = 'security-info-section';
            errorSection.innerHTML = `
                <div class="security-info-title">Twitter Information</div>
                <div class="security-info-row">
                    <span class="security-info-value">Unable to fetch Twitter data or account not found</span>
                </div>
            `;
            popup.querySelector('.security-popup-content').appendChild(errorSection);
            return;
        }
    
        const twitterSection = document.createElement('div');
        twitterSection.className = 'security-info-section';
        twitterSection.innerHTML = `
            <div class="security-info-title">Twitter Information</div>
            <div class="security-info-row">
                <span class="security-info-label">Username:</span>
                <span class="security-info-value">@${twitterData.data.username || 'N/A'}</span>
            </div>
            <div class="security-info-row">
                <span class="security-info-label">Created:</span>
                <span class="security-info-value">${twitterData.data.created_at ? new Date(twitterData.data.created_at).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div class="security-info-row">
                <span class="security-info-label">Followers:</span>
                <span class="security-info-value">${(twitterData.data.public_metrics?.followers_count || 0).toLocaleString()}</span>
            </div>
            <div class="security-info-row">
                <span class="security-info-label">Following:</span>
                <span class="security-info-value">${(twitterData.data.public_metrics?.following_count || 0).toLocaleString()}</span>
            </div>
            <div class="security-info-row">
                <span class="security-info-label">Tweet Count:</span>
                <span class="security-info-value">${(twitterData.data.public_metrics?.tweet_count || 0).toLocaleString()}</span>
            </div>
            <div class="security-info-row">
                <span class="security-info-label">Verified:</span>
                <span class="security-info-value">${twitterData.data.verified ? 'Yes' : 'No'}</span>
            </div>
        `;
    
        const popupContent = popup.querySelector('.security-popup-content');
        popupContent.appendChild(twitterSection);

        const recycledWarning = this.getRecycledUsernameWarning(twitterData);
        if (recycledWarning) {
            const warningElement = document.createElement('div');
            warningElement.innerHTML = recycledWarning;
            popupContent.appendChild(warningElement);
        }

        const usernameHistory = this.getTwitterUsernameHistory(twitterData);
        if (usernameHistory) {
            const historyElement = document.createElement('div');
            historyElement.innerHTML = usernameHistory;
            popupContent.appendChild(historyElement);
        }
    }

    async showSecurityPopup(tokenName, tokenSymbol, websiteUrl, twitterData, contractAddress) {
        const backdrop = document.createElement('div');
        backdrop.className = 'security-popup-backdrop';
        document.body.appendChild(backdrop);
    
        const popup = document.createElement('div');
        popup.className = 'security-popup';
        popup.innerHTML = `
            <div class="security-popup-header">
                <h3>Security Information</h3>
                <button class="close-popup">×</button>
            </div>
            <div class="security-popup-content">
                <div class="security-info-section">
                    <div class="security-info-title">Token Information</div>
                    <div class="security-info-row">
                        <span class="security-info-label">Name:</span>
                        <span class="security-info-value">${tokenName || 'N/A'}</span>
                    </div>
                    <div class="security-info-row">
                        <span class="security-info-label">Symbol:</span>
                        <span class="security-info-value">${tokenSymbol || 'N/A'}</span>
                    </div>
                    <div class="security-info-row">
                        <span class="security-info-label">CA:</span>
                        <span class="ca-container">
                            <span class="security-info-value ca-display" title="${contractAddress || ''}" data-full-address="${contractAddress || ''}">
                                ${this.truncateAddress(contractAddress)}
                            </span>
                            ${contractAddress ? `
                                <span class="copy-icon" title="Copy address">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </span>
                            ` : ''}
                        </span>
                    </div>
                </div>
                <div class="security-info-section">
                    <div class="security-info-title">Domain Information</div>
                    <div id="domain-info-content">
                        <div class="loader"></div>
                    </div>
                </div>
                <div class="security-info-section">
                    <div class="security-info-title">Website Content Verify</div>
                    <div id="website-verification-content">
                        <div class="loader"></div>
                    </div>
                </div>
            </div>
        `;
    
        document.body.appendChild(popup);

        const caContainer = popup.querySelector('.ca-container');
        if (caContainer && contractAddress) {
            caContainer.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(contractAddress);

                    const copyIcon = caContainer.querySelector('.copy-icon');
                    const originalHTML = copyIcon.innerHTML;
                    copyIcon.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                    copyIcon.style.color = '#10B981';

                    setTimeout(() => {
                        copyIcon.innerHTML = originalHTML;
                        copyIcon.style.color = '';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                }
            });
        }
    
        const closePopup = () => {
            popup.remove();
            backdrop.remove();
            this.usedApiKeys.clear();
        };
    
        popup.querySelector('.close-popup').addEventListener('click', closePopup);
        backdrop.addEventListener('click', closePopup);
    
        if (websiteUrl) {
            const verificationContent = popup.querySelector('#website-verification-content');
            try {
                verificationContent.innerHTML = `
                    <div class="security-info-row">
                        <div class="loader"></div>
                        <span class="security-info-value ml-2">Checking website content...</span>
                    </div>
                `;
    
                const contentVerification = await this.checkWebsiteContent(websiteUrl, tokenName, tokenSymbol, contractAddress);
                
                if (contentVerification.error) {
                    verificationContent.innerHTML = `
                        <div class="security-info-row error">
                            <span class="security-info-value">⚠️ ${contentVerification.error}</span>
                        </div>
                        <div class="security-info-row">
                            <span class="security-info-value text-sm text-gray-400">Note: Some websites may block automated access</span>
                        </div>
                    `;
                } else {
                    verificationContent.innerHTML = `
                        <div class="security-info-row">
                            <span class="security-info-label">Token Name (${contentVerification.matches.tokenNameMatches} matches):</span>
                            <span class="security-info-value ${contentVerification.hasTokenName ? 'text-green-500' : 'text-red-500'}">
                                ${contentVerification.hasTokenName ? '✅ Found' : '❌ Not Found'}
                            </span>
                        </div>
                        <div class="security-info-row">
                            <span class="security-info-label">Token Symbol (${contentVerification.matches.symbolMatches} matches):</span>
                            <span class="security-info-value ${contentVerification.hasTokenSymbol ? 'text-green-500' : 'text-red-500'}">
                                ${contentVerification.hasTokenSymbol ? '✅ Found' : '❌ Not Found'}
                            </span>
                        </div>
                        <div class="security-info-row">
                            <span class="security-info-label">Contract Address (${contentVerification.matches.contractMatches} matches):</span>
                            <span class="security-info-value ${contentVerification.hasContractAddress ? 'text-green-500' : 'text-red-500'}">
                                ${contentVerification.hasContractAddress ? '✅ Found' : '❌ Not Found'}
                            </span>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error in website verification:', error);
                verificationContent.innerHTML = `
                    <div class="security-info-row error">
                        <span class="security-info-value">⚠️ Error: ${error.message}</span>
                    </div>
                    <div class="security-info-row">
                        <span class="security-info-value text-sm text-gray-400">Please try again later</span>
                    </div>
                `;
            }

            try {
                console.log('Fetching domain info for:', websiteUrl);
                const url = new URL(websiteUrl);
                console.log('Parsed domain:', url.hostname);
                
                const domainInfo = await this.makeWhoisRequest(url.hostname);
                console.log('Parsed domain info:', domainInfo);
    
                const domainContent = popup.querySelector('#domain-info-content');
                if (domainInfo && domainInfo.WhoisRecord) {
                    const record = domainInfo.WhoisRecord;
                    
                    const createdDate = 
                        record.registryData?.createdDate || 
                        record.registryData?.audit?.createdDate ||
                        record.audit?.createdDate ||
                        record.createdDate ||
                        'N/A';
    
                    const expiresDate = 
                        record.registryData?.expiresDate ||
                        record.registryData?.audit?.expiresDate ||
                        record.audit?.expiresDate ||
                        record.expiresDate ||
                        'N/A';
    
                    const formattedCreatedDate = createdDate !== 'N/A' ? new Date(createdDate).toLocaleDateString() : 'N/A';
                    const formattedExpiresDate = expiresDate !== 'N/A' ? new Date(expiresDate).toLocaleDateString() : 'N/A';
    
                    domainContent.innerHTML = `
                        <div class="security-info-row">
                            <span class="security-info-label">Domain:</span>
                            <span class="security-info-value">${url.hostname}</span>
                        </div>
                        <div class="security-info-row">
                            <span class="security-info-label">Creation Date:</span>
                            <span class="security-info-value">${formattedCreatedDate}</span>
                        </div>
                        <div class="security-info-row">
                            <span class="security-info-label">Expiration Date:</span>
                            <span class="security-info-value">${formattedExpiresDate}</span>
                        </div>
                        <div class="security-info-row">
                            <span class="security-info-label">Registrar:</span>
                            <span class="security-info-value">${record.registrarName || 'N/A'}</span>
                        </div>
                        <div class="security-info-row">
                            <span class="security-info-label">Origin Country:</span>
                            <span class="security-info-value">${record.registryData?.country || record.registrant?.country || 'N/A'}</span>
                        </div>
                    `;
                } else {
                    domainContent.innerHTML = '<div class="security-info-row">Unable to parse domain information</div>';
                }
            } catch (error) {
                console.error('Error fetching domain info:', error);
                popup.querySelector('#domain-info-content').innerHTML = `
                    <div class="security-info-row">Error fetching domain information: ${error.message}</div>
                `;
            }
        } else {
            popup.querySelector('#domain-info-content').innerHTML = '<div class="security-info-row">No website URL available</div>';
            popup.querySelector('#website-verification-content').innerHTML = '<div class="security-info-row">No website URL available</div>';
        }
    }


    filterRows() {
        document.querySelectorAll('.pump-card').forEach(row => {
            const nameElement = row.querySelector('.font-medium.text-grey-50');
            const tickerElement = row.querySelector('.font-normal.text-grey-200');

            const tokenName = nameElement?.textContent.trim().toLowerCase() || '';
            const tokenTicker = tickerElement?.textContent.trim().toLowerCase() || '';

            const isBlacklisted = [...this.blacklist].some(term =>
                tokenName.includes(term) || tokenTicker.includes(term)
            );

            if (isBlacklisted) {
                row.style.display = 'none';
                return;
            }

            const matchesSearch = this.searchTerms.length === 0 || this.searchTerms.some(term =>
                tokenName.includes(term) || tokenTicker.includes(term)
            );

            row.style.display = matchesSearch ? '' : 'none';
        });
    }

    updateSearchHistory(rawInput) {
        const trimmedInput = rawInput.trim();
        if (trimmedInput === '') return;

        const index = this.searchHistory.indexOf(trimmedInput);
        if (index !== -1) {
            this.searchHistory.splice(index, 1);
        }

        this.searchHistory.unshift(trimmedInput);

        if (this.searchHistory.length > 100) {
            this.searchHistory.pop();
        }

        localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.searchHistory));
    }

    applySearchFromHistory(historyItem) {
        const searchInput = document.querySelector('[placeholder="Search tokens..."]');
        if (searchInput) {
            searchInput.value = historyItem;
            this.searchTerms = historyItem
                .split(',')
                .map(term => term.trim().toLowerCase())
                .filter(term => term !== '');
            this.filterRows();
            this.updateSearchHistory(historyItem);
        }
    }
}

new TokenEnhancer();
console.log("Background script loaded.");
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed!');
  
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_TWITTER') {
      fetch(request.url, {
          headers: request.headers
      })
      .then(response => response.json())
      .then(data => sendResponse({ data }))
      .catch(error => sendResponse({ error: error.message }));

      return true;
  }
  
  if (request.type === 'FETCH_WEBSITE') {
      console.log('Attempting to fetch website:', request.url);
      
      fetch(request.url, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
          }
      })
      .then(response => {
          console.log('Fetch response status:', response.status);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
      })
      .then(text => {
          console.log('Successfully fetched website content');
          sendResponse({ data: text });
      })
      .catch(error => {
          console.error('Error fetching website:', error);
          sendResponse({ error: error.message });
      });

      return true;
  }
});


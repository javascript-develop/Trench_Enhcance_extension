const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    popup: './src/popup/index.jsx',  
    background: './src/background.js', 
    content: './src/content.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js', 
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/, 
        exclude: /node_modules/,
        use: 'ts-loader', 
      },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader',"postcss-loader",],
        
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' }, 
        { from: 'src/icons', to: 'icons' },
        { from: 'src/styles.css', to: 'styles.css' },
      ],
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/index.html', 
      filename: 'index.html', 
    }),
  ],
};

var path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: './js/_webpack_entry.js',
    output: {
        path: path.resolve(__dirname, './'),
        filename: '_webpack.js'
    }, 
    plugins: [
        new CopyPlugin( {patterns: [
            //JQuery
            { from: './node_modules/jquery/dist/jquery.min.js', to: './vendor/jquery' },
            // Bootstrap
            { from: './node_modules/bootstrap/dist/js/bootstrap.bundle.min.js', to: './vendor/bootstrap' },
            { from: './node_modules/bootstrap/dist/js/bootstrap.bundle.min.js.map', to: './vendor/bootstrap' },
            { from: './node_modules/bootstrap/scss/', to: './vendor/bootstrap/_scss' },
            // Font Awesome
            { from: './node_modules/font-awesome/fonts', to: './vendor/font-awesome/fonts' },
            { from: './node_modules/font-awesome/scss', to: './vendor/font-awesome/_scss' },
            // intersection-observer.js
            { 
              from: './node_modules/intersection-observer/intersection-observer.js', to: './vendor/intersection-observer/'
            }
        ]}),
    ],
};
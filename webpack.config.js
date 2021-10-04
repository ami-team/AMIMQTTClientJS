/*--------------------------------------------------------------------------------------------------------------------*/

const PACKAGE = require('./package.json');

/*--------------------------------------------------------------------------------------------------------------------*/

const BANNER = `ami-mqtt-client ${PACKAGE.version}, AMI MQTT Client
https://gitlab.in2p3.fr/ami-team/amimqttclient/
Copyright (c) 2021-${new Date().getFullYear()} Jérôme Odier`;

/*--------------------------------------------------------------------------------------------------------------------*/

const BROWSER_LIST = [
	'>= 1%',
	'last 1 major version',
	'not dead',
	'Chrome >= 45',
	'Firefox >= 38',
	'Edge >= 12',
	'Explorer >= 10',
	'iOS >= 9',
	'Safari >= 9',
	'Android >= 4.4',
	'Opera >= 30'
];

/*--------------------------------------------------------------------------------------------------------------------*/

console.log('Building AMI MQTT Client for: ' + BROWSER_LIST.join(', '));

/*--------------------------------------------------------------------------------------------------------------------*/

const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

/*--------------------------------------------------------------------------------------------------------------------*/

module.exports = {
	'entry': {
		'ami-mqtt-client.min': path.resolve(__dirname, 'src/client.js')
	},
	'output': {
		'path': path.resolve(__dirname, 'dist'),
		'filename': '[name].js'
	},
	'module': {
		'rules': [
			/*--------------------------------------------------------------------------------------------------------*/

			{
				'test': /\.js$/,
				'exclude': /node_modules/,
				'use': {
					'loader': 'babel-loader',
					'options': {
						'comments': false,
						'compact': false,
						'minified': false,
						'presets': [
							['@babel/preset-env', {
								'targets': {
									'browsers': BROWSER_LIST
								}
							}]
						]
					}
				}
			}

			/*--------------------------------------------------------------------------------------------------------*/
		]
	},
	'plugins': [
		new webpack.BannerPlugin({
			'banner': BANNER
		})
	],
	'optimization': {
		'minimizer': [
			new TerserPlugin({
				'test': /\.min\.js$/,
				'parallel': true,
				'extractComments': false,
			})
		]
	}
};

/*--------------------------------------------------------------------------------------------------------------------*/

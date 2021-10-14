/*--------------------------------------------------------------------------------------------------------------------*/

const PACKAGE = require('./package.json');

/*--------------------------------------------------------------------------------------------------------------------*/

const BANNER = `Copyright © 2021-${new Date().getFullYear()} CNRS/LPSC

Author: Jérôme ODIER (jerome.odier@lpsc.in2p3.fr)

Repositories: https://gitlab.in2p3.fr/ami-team/AMIMQTTClientJS/
              https://www.github.com/ami-team/AMIMQTTClientJS/

This software is a computer program whose purpose is to provide an
Eclipse Paho-based MQTT Client to the ATLAS Metadata Interface (AMI)
ecosystem.

This software is governed by the CeCILL-C license under French law and
abiding by the rules of distribution of free software. You can use, 
modify and/or redistribute the software under the terms of the CeCILL-C
license as circulated by CEA, CNRS and INRIA at the following URL
"http://www.cecill.info". 

The fact that you are presently reading this means that you have had
knowledge of the CeCILL-C license and that you accept its terms.
`

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
const ESLintPlugin = require('eslint-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

/*--------------------------------------------------------------------------------------------------------------------*/

module.exports = {
	'entry': {
/*		'ami-mqtt-client': path.resolve(__dirname, 'src/client.js'),
 */		'ami-mqtt-client.min': path.resolve(__dirname, 'src/client.js')
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
		new ESLintPlugin({
		}),
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

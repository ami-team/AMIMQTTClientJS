/*--------------------------------------------------------------------------------------------------------------------*/

const PACKAGE = require('./package.json');

/*--------------------------------------------------------------------------------------------------------------------*/

const BANNER = `Copyright © 2021-${new Date().getFullYear()} CNRS/LPSC

Repository: https://gitlab.in2p3.fr/ami-team/AMIMQTTClientJS/
Author: Jérôme ODIER (jerome.odier@lpsc.in2p3.fr)

This software is a computer program whose purpose is to provide an
Eclipse Paho-based MQTT Client to the ATLAS Metadata Interface (AMI)
ecosystem.

This software is governed by the CeCILL-C license under French law and
abiding by the rules of distribution of free software. You can use, 
modify and/or redistribute the software under the terms of the CeCILL-C
license as circulated by CEA, CNRS and INRIA at the following URL
"http://www.cecill.info". 

As a counterpart to the access to the source code and rights to copy,
modify and redistribute granted by the license, users are provided only
with a limited warranty and the software's author, the holder of the
economic rights, and the successive licensors have only limited
liability. 

In this respect, the user's attention is drawn to the risks associated
with loading, using, modifying and/or developing or reproducing the
software by the user in light of its specific status of free software,
that may mean that it is complicated to manipulate, and that also
therefore means that it is reserved for developers and experienced
professionals having in-depth computer knowledge. Users are therefore
encouraged to load and test the software's suitability as regards their
requirements in conditions enabling the security of their systems and/or 
data to be ensured and, more generally, to use and operate it in the 
same conditions as regards security. 

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

/*!
 * AMI MQTT Client Java
 *
 * Copyright (c) 2014-2021 The AMI Team, CNRS/LPSC
 *
 * This file must be used under the terms of the CeCILL-C:
 * http://www.cecill.info/licences/Licence_CeCILL-C_V1-en.html
 * http://www.cecill.info/licences/Licence_CeCILL-C_V1-fr.html
 *
 */

'use strict';

/*--------------------------------------------------------------------------------------------------------------------*/

import { Client, Message } from 'paho-mqtt';

import JSPath from 'jspath';

/*--------------------------------------------------------------------------------------------------------------------*/
/* JWT                                                                                                                */
/*--------------------------------------------------------------------------------------------------------------------*/

/**
 * Parse a JWT token
 * @param {string} token the JWT token
 * @returns {Object<string,string>} The JWT token content
 */

function parseJwt(token)
{
	try
	{
		const parts = token.split('.');

		if(parts.length > 1)
		{
			/*--------------------------------------------------------------------------------------------------------*/
			/* DECODE PAYLOAD                                                                                         */
			/*--------------------------------------------------------------------------------------------------------*/

			const payload = decodeURIComponent(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map((c) => {

				return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);

			}).join(''));

			/*--------------------------------------------------------------------------------------------------------*/
			/* PARSE PAYLOAD                                                                                          */
			/*--------------------------------------------------------------------------------------------------------*/

			return JSON.parse(payload);

			/*--------------------------------------------------------------------------------------------------------*/
		}
		else
		{
			return {};
		}
	}
	catch(e)
	{
		return {};
	}
}

/*--------------------------------------------------------------------------------------------------------------------*/
/* CLIENT                                                                                                             */
/*--------------------------------------------------------------------------------------------------------------------*/

// noinspection JSUnusedGlobalSymbols

/**
 * Class representing an AMI MQTT client
 */

class AMIMQTTClient
{
	/*----------------------------------------------------------------------------------------------------------------*/
	/* PUBLIC VARIABLES                                                                                               */
	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Library version
	 * @type {String}
	 */

	version = '{{VERSION}}';

	/*----------------------------------------------------------------------------------------------------------------*/
	/* PRIVATE VARIABLES                                                                                              */
	/*----------------------------------------------------------------------------------------------------------------*/

	#L = {};

	#cnt = 0x01;

	#connected = false;

	#converter = 'AMIXmlToJson.xsl';

	#paramRegExp = new RegExp('-\\W*([a-zA-Z][a-zA-Z0-9]*)\\W*=\\W*\\?', 'g');

	#responseRegExp = new RegExp('AMI-RESPONSE<([0-9]+),(true|false)>(.*)', 's');

	/*----------------------------------------------------------------------------------------------------------------*/
	/* PUBLIC METHODS                                                                                                 */
	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * An AMI MQTT client
	 * @param {string} endpoint the endpoint
	 * @param {Object<string,*>} [options={}] dictionary of optional parameters (discoveryTopic, triggerDiscoveryTopic, onConnected, onConnectionLost, onMessageArrived, onMessageDelivered)
	 * @returns {AMIMQTTClient} The AMI MQTT client
	 */

	constructor(endpoint, options)
	{
		options = options || {};

		/*------------------------------------------------------------------------------------------------------------*/

		const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {

			const r = 16 * Math.random(), v = (c === 'x') ? (r | 0x000000000)
			                                              : (r & 0x03 | 0x08)
			;

			return v.toString(16);
		});

		/*------------------------------------------------------------------------------------------------------------*/

		this._uuid = uuid;

		this._endpoint = endpoint;

		this._discoveryTopic = options.discoveryTopic;
		this._triggerDiscoveryTopic = options.triggerDiscoveryTopic;

		/*------------------------------------------------------------------------------------------------------------*/

		this._userOnConnected        = options.onConnected        || null;
		this._userOnConnectionLost   = options.onConnectionLost   || null;
		this._userOnMessageArrived   = options.onMessageArrived   || null;
		this._userOnMessageDelivered = options.onMessageDelivered || null;

		/*------------------------------------------------------------------------------------------------------------*/

		const url = new URL(endpoint);

		/*------------------------------------------------------------------------------------------------------------*/

		this._useSSL = url.protocol === 'wss:';

		/*------------------------------------------------------------------------------------------------------------*/

		this._client = new Client(url.hostname, parseInt(url.port || '443'), url.pathname, uuid);

		/*------------------------------------------------------------------------------------------------------------*/

		this._client.onConnected        = (...args) => this.#onConnected       .apply(this, args);
		this._client.onConnectionLost   = (...args) => this.#onConnectionLost  .apply(this, args);
		this._client.onMessageArrived   = (...args) => this.#onMessageArrived  .apply(this, args);
		this._client.onMessageDelivered = (...args) => this.#onMessageDelivered.apply(this, args);

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Set the 'onConnected' handler
	 * @param {function} onConnected the new 'onConnected' handler
	 * @returns {AMIMQTTClient} This AMI MQTT client
	 */

	setOnConnected(onConnected) {
		this._userOnConnected = onConnected;
		return this;
	}

	/**
	 * Set the 'onConnectionLost' handler
	 * @param {function} onConnectionLost the new 'onConnectionLost' handler
	 * @returns {AMIMQTTClient} This AMI MQTT client
	 */

	setOnConnectionLost(onConnectionLost) {
		this._userOnConnectionLost = onConnectionLost;
		return this;
	}

	/**
	 * Set the 'onMessageArrived' handler
	 * @param {function} onMessageArrived the new 'onMessageArrived' handler
	 * @returns {AMIMQTTClient} This AMI MQTT client
	 */

	setOnMessageArrived(onMessageArrived) {
		this._userOnMessageArrived = onMessageArrived;
		return this;
	}

	/**
	 * Set the 'onMessageDelivered' handler
	 * @param {function} onMessageDelivered the new 'onMessageDelivered' handler
	 * @returns {AMIMQTTClient} This AMI MQTT client
	 */

	setOnMessageDelivered(onMessageDelivered) {
		this._userOnMessageDelivered = onMessageDelivered;
		return this;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Sign in by JWT token
	 * @param {string} password the password
	 * @param {string} [serverName=''] the server name
	 * @returns {Promise} A JavaScript promise object
	 */

	signInByToken(password, serverName = '')
	{
		return new Promise((resolve, reject) => {

			/*--------------------------------------------------------------------------------------------------------*/

			const username = parseJwt(password).sub;

			/*--------------------------------------------------------------------------------------------------------*/

			if(username)
			{
				/*----------------------------------------------------------------------------------------------------*/

				this._username = username;

				this._serverName = serverName;

				/*----------------------------------------------------------------------------------------------------*/

				if(this._serverName || this._discoveryTopic)
				{
					try
					{
						this._client.connect({
							useSSL: this._useSSL,
							userName: username,
							password: password,
							reconnect: true,
							/**/
							onSuccess: () => { resolve(this._uuid); },
							onFailure: (x, y, errorMessage) => { reject(errorMessage); },
						});
					}
					catch(errorMessage)
					{
						reject(`error connecting to MQTT broker: ${errorMessage}`);
					}
				}
				else
				{
					reject('option `discoveryTopic` is null');
				}

				/*----------------------------------------------------------------------------------------------------*/
			}
			else
			{
				reject('invalid token');
			}
		});
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Sign out
	 * @returns {Promise} A JavaScript promise object
	 */

	signOut()
	{
		return new Promise((resolve, reject) => {

			/*--------------------------------------------------------------------------------------------------------*/

			try
			{
				this._client.disconnect();

				resolve(this._uuid);
			}
			catch(errorMessage)
			{
				reject(errorMessage);
			}

			/*--------------------------------------------------------------------------------------------------------*/
		});
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Check weather the client is connected
	 * @returns {boolean} The client connection status
	 */

	isConnected()
	{
		return this.#connected;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Get the client UUID
	 * @returns {string} The client UUID
	 */

	getUUID()
	{
		return this._uuid;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Get the endpoint
	 * @returns {string} The endpoint
	 */

	getEndpoint()
	{
		return this._endpoint;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Get the server name
	 * @returns {string} The server name
	 */

	getServerName()
	{
		return this._serverName;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Get the username
	 * @returns {string} The username
	 */

	getUsername()
	{
		return this._username;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Subscribe a MQTT topic
	 * @param {string} topic the topic
	 * @param {Object<string,*>} [options={}] dictionary of optional parameters (qos=0,1,2, timeout [ms])
	 * @returns {Promise} A JavaScript promise object
	 */

	subscribe(topic, options)
	{
		options = options || {};

		return new Promise((resolve, reject) => {

			try
			{
				this._client.subscribe(
					topic,
					{
						qos: options.qos || 0,
						timeout: options.timeout || 10000,
						/**/
						onSuccess: () => { resolve(); },
						onFailure: (x, y, errorMessage) => { reject(errorMessage); },
					}
				);
			}
			catch(errorMessage)
			{
				reject(errorMessage);
			}
		});
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Unsubscribe a MQTT topic
	 * @param {string} topic the topic
	 * @param {Object<string,*>} [options={}] dictionary of optional parameters (qos=0,1,2, timeout [ms])
	 * @returns {Promise} A JavaScript promise object
	 */

	unsubscribe(topic, options)
	{
		options = options || {};

		return new Promise((resolve, reject) => {

			try
			{
				this._client.unsubscribe(
					topic,
					{
						qos: options.qos || 0,
						timeout: options.timeout || 10000,
						/**/
						onSuccess: () => { resolve(); },
						onFailure: (x, y, errorMessage) => { reject(errorMessage); },
					}
				);
			}
			catch(errorMessage)
			{
				reject(errorMessage);
			}
		});
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Sends a MQTT message
	 * @param {string} topic the topic
	 * @param {string} payload the payload
	 * @param {Object<string,*>} [options={}] dictionary of optional parameters (qos=0,1,2, retained=true,false)
	 * @returns {Number} The MQTT message token
	 */

	send(topic, payload, options)
	{
		options = options || {};

		/*------------------------------------------------------------------------------------------------------------*/

		const token = this.#cnt++;

		/*------------------------------------------------------------------------------------------------------------*/

		const message = new Message(payload);

		message.token    = token;
		message.topic    = topic;
		message.qos      = options.qos      || 0x000;
		message.retained = options.retained || false;

		/*------------------------------------------------------------------------------------------------------------*/

		this._client.send(message);

		/*------------------------------------------------------------------------------------------------------------*/

		return token;

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	static #response(data, message, urlWithParameters, jsonError)
	{
		if(jsonError)
		{
			data = {'AMIMessage': [{'error': [{'$': data}]}]};
		}

		return {
			data: data,
			message: message,
			urlWithParameters: urlWithParameters,
		};
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Executes an AMI command
	 * @param {string} command the AMI command
	 * @param {Object<string,*>} [options={}] dictionary of optional parameters (serverName, converter, timeout [ms])
	 * @returns {Promise} A JavaScript promise object
	 */

	execute(command, options)
	{
		options = options || {};

		/*------------------------------------------------------------------------------------------------------------*/

		const token = this.#cnt++;

		/*------------------------------------------------------------------------------------------------------------*/

		const params = options.params || [];

		/*------------------------------------------------------------------------------------------------------------*/

		const serverName = ('serverName' in options) ? (options.serverName || this._serverName) : this._serverName;

		const converter = ('converter' in options) ? (options.converter || /*--*/ '' /*--*/) : this.#converter;

		/*------------------------------------------------------------------------------------------------------------*/

		command = (command || '').trim().replace(this.#paramRegExp, (x, y) => {

			const rawValue = params.shift();

			return Object.prototype.toString.call(rawValue) === '[object String]' ? `-${y}=${JSON.stringify(rawValue)}`
			                                                                      : `-${y}="${JSON.stringify(rawValue)}"`
			;
		});

		/*------------------------------------------------------------------------------------------------------------*/

		const topic = `ami/${serverName}/command/${converter}`;

		const message = new Message(`AMI-COMMAND<${token},"${this._uuid}","${this._username}">${command}`);

		message.token    = token;
		message.topic    = topic;
		message.qos      = options.qos      || 0x000;
		message.retained = options.retained || false;

		/*------------------------------------------------------------------------------------------------------------*/

		return new Promise((resolve, reject) => {

			/*--------------------------------------------------------------------------------------------------------*/

			try
			{
				this._client.send(message);
			}
			catch(errorMessage)
			{
				reject(errorMessage);
			}

			/*--------------------------------------------------------------------------------------------------------*/

			this.#L[token] = {
				resolve: resolve,
				reject: reject,
			};

			/*--------------------------------------------------------------------------------------------------------*/

			setTimeout(() => {

				if(token in this.#L)
				{
					reject(AMIMQTTClient.#response('timeout', 'timeout', token, converter === 'AMIXmlToJson.xsl'));

					delete this.#L[token];
				}

			}, options.timeout || 10000);

			/*--------------------------------------------------------------------------------------------------------*/
		});

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	 * Finds data within the given JSON, see {@link https://github.com/dfilatov/jspath}
	 * @param {string} path the path
	 * @param {Object<string,*>} json the JSON
	 * @returns {Array<*>} The resulting array
	 */

	jspath(path, json)
	{
		return JSPath.apply(path, json);
	}

	/*----------------------------------------------------------------------------------------------------------------*/
	/* PRIVATE METHODS                                                                                                */
	/*----------------------------------------------------------------------------------------------------------------*/

	#onConnected(reconnect, endpoint)
	{
		/*------------------------------------------------------------------------------------------------------------*/

		this.#connected = true;

		/*------------------------------------------------------------------------------------------------------------*/

		if(reconnect) {
			console.log(`onConnected: client \`${this._uuid}\` reconnected to server URL \`${this._endpoint}\``);
		}
		else {
			console.log(`onConnected: client \`${this._uuid}\` connected to server URL \`${this._endpoint}\``);
		}

		/*------------------------------------------------------------------------------------------------------------*/

		this.subscribe(this._uuid).finally(() => {

			if(!this._serverName)
			{
				if(this._discoveryTopic)
				{
					this.subscribe(this._discoveryTopic).then(() => {

						if(this._triggerDiscoveryTopic)
						{
							this.send(this._triggerDiscoveryTopic, '{}');
						}
					});
				}
			}
			else
			{
				if(this._userOnConnected)
				{
					this._userOnConnected(this, reconnect, endpoint);
				}
			}
		});

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	#onConnectionLost(responseObject)
	{
		/*------------------------------------------------------------------------------------------------------------*/

		this.#connected = false;

		/*------------------------------------------------------------------------------------------------------------*/

		if(responseObject.errorCode !== 0)
		{
			console.log(`onConnectionLost: client \`${this._uuid}\` disconnected, cause: ${responseObject.errorMessage}`);

			if(this._userOnConnectionLost)
			{
				this._userOnConnectionLost(this, responseObject.errorMessage);
			}
		}

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	#onMessageArrived(message)
	{
		const m = message.payloadString.match(this.#responseRegExp);

		/**/ if(message.topic === this._discoveryTopic && !this._serverName)
		{
			/*--------------------------------------------------------------------------------------------------------*/
			/* AMI SERVER DETECTION MESSAGE                                                                           */
			/*--------------------------------------------------------------------------------------------------------*/

			const json = JSON.parse(message.payloadString);

			if(json['server_name'])
			{
				/*----------------------------------------------------------------------------------------------------*/

				this._serverName = json['server_name'];

				/*----------------------------------------------------------------------------------------------------*/

				if(this._userOnConnected)
				{
					this._userOnConnected(this, false, this._endpoint);
				}

				/*----------------------------------------------------------------------------------------------------*/
			}

			/*--------------------------------------------------------------------------------------------------------*/
		}
		else if(message.topic === this._uuid && m)
		{
			/*--------------------------------------------------------------------------------------------------------*/
			/* AMI COMMAND RESULT MESSAGE                                                                             */
			/*--------------------------------------------------------------------------------------------------------*/

			const token = parseInt(m[1]);

			const json = /*----*/(m[2]);

			const data = /*---*/(m[3]);

			/*--------------------------------------------------------------------------------------------------------*/

			if(token in this.#L)
			{
				if(json === 'true')
				{
					try
					{
						const json = JSON.parse(data);

						const info = JSPath.apply('.AMIMessage.info.$', json);
						const error = JSPath.apply('.AMIMessage.error.$', json);

						if(error.length === 0)
						{
							this.#L[token].resolve(AMIMQTTClient.#response(json, info.join('. '), token, false));
						}
						else
						{
							this.#L[token].reject(AMIMQTTClient.#response(json, error.join('. '), token, true));
						}
					}
					catch(e)
					{
						this.#L[token].reject(AMIMQTTClient.#response('invalid JSON', 'invalid JSON', token, true));
					}
				}
				else
				{
					this.#L[token].resolve(AMIMQTTClient.#response(data, '', token, false));
				}

				delete this.#L[token];
			}

			/*--------------------------------------------------------------------------------------------------------*/
		}
		else
		{
			/*--------------------------------------------------------------------------------------------------------*/
			/* OTHER MESSAGE                                                                                          */
			/*--------------------------------------------------------------------------------------------------------*/

			if(this._userOnMessageArrived)
			{
				this._userOnMessageArrived(this, message.topic, message.payloadString, message.qos, message.retained);
			}

			/*--------------------------------------------------------------------------------------------------------*/
		}
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	#onMessageDelivered(message)
	{
		if(this._userOnMessageDelivered)
		{
			this._userOnMessageDelivered(this, message.token);
		}
	}

	/*----------------------------------------------------------------------------------------------------------------*/
}

/*--------------------------------------------------------------------------------------------------------------------*/
/* BROWSER SUPPORT                                                                                                    */
/*--------------------------------------------------------------------------------------------------------------------*/

if(typeof window !== 'undefined') window.AMIMQTTClient = AMIMQTTClient;

/*--------------------------------------------------------------------------------------------------------------------*/

export default AMIMQTTClient;

/*--------------------------------------------------------------------------------------------------------------------*/

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

import Paho from 'paho-mqtt';

import JSPath from 'jspath';

/*--------------------------------------------------------------------------------------------------------------------*/
/* JWT                                                                                                                */
/*--------------------------------------------------------------------------------------------------------------------*/

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

			const uriEncodedPayload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map((c) => {

				return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);

			}).join('');

			/*--------------------------------------------------------------------------------------------------------*/

			const payload = decodeURIComponent(uriEncodedPayload);

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

/** Class representing AMI MQTT client
  */

export default class AMIMQTTClient
{
	/*----------------------------------------------------------------------------------------------------------------*/
	/* VARIABLES                                                                                                      */
	/*----------------------------------------------------------------------------------------------------------------*/

	#L = {};

	#cnt = 0x01;

	#converter = 'AMIXmlToJson.xsl';

	#paramRegExp = new RegExp('-\\W*([a-zA-Z][a-zA-Z0-9]*)\\W*=\\W*\\?', 'g');

	#responseRegExp = new RegExp('AMI-RESPONSE<([0-9]+),(true|false)>(.*)', 's');

	/*----------------------------------------------------------------------------------------------------------------*/
	/* METHODS                                                                                                        */
	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * An AMI MQTT client
	  * @param {String} endpoint the endpoint
	  * @param {Object} [options] dictionary of optional parameters (onConnected, onConnectionLost, onMessageArrived, onMessageDelivered)
	  * @returns {AMIMQTTClient} The AMI MQTT client
	  */

	constructor(endpoint, options)
	{
		options = options || {};

		/*------------------------------------------------------------------------------------------------------------*/

		const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {

			const r = 16 * Math.random(), v = (c == 'x') ? (r | 0x000000000)
			                                             : (r & 0x03 | 0x08)
			;

			return v.toString(16);
		});

		/*------------------------------------------------------------------------------------------------------------*/

		this._uuid = uuid;

		this._endpoint = endpoint;

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

		this._client = new Paho.Client(url.hostname, parseInt(url.port || '443'), url.pathname, uuid);

		/*------------------------------------------------------------------------------------------------------------*/

		this._client.onConnected        = (...args) => this.#onConnected       .apply(this, args);
		this._client.onConnectionLost   = (...args) => this.#onConnectionLost  .apply(this, args);
		this._client.onMessageArrived   = (...args) => this.#onMessageArrived  .apply(this, args);
		this._client.onMessageDelivered = (...args) => this.#onMessageDelivered.apply(this, args);

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Sign in by JWT token
	  * @param {String} password the password
	  * @param {String} serverName the server name
	  * @returns {$.Deferred} A JQuery deferred object
	  */

	signInByToken(password, serverName)
	{
		const result = $.Deferred();

		/*------------------------------------------------------------------------------------------------------------*/

		const username = parseJwt(password).sub;

		/*------------------------------------------------------------------------------------------------------------*/

		if(username)
		{
			/*--------------------------------------------------------------------------------------------------------*/

			this._username = username;

			this._serverName = serverName;

			/*--------------------------------------------------------------------------------------------------------*/

			this._client.connect({
				useSSL: this._useSSL,
				userName: username,
				password: password,
				reconnect: true,
				/**/
				onSuccess: () => { result.resolve(this._uuid); },
				onFailure: (x, y, errorMessage) => { result.reject(errorMessage); },
			});

			/*--------------------------------------------------------------------------------------------------------*/
		}
		else
		{
			result.reject(999, 'invalid token');
		}

		/*------------------------------------------------------------------------------------------------------------*/

		return result.promise();
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Sign out
	  * @returns {$.Deferred} A JQuery deferred object
	  */

	signOut()
	{
		const result = $.Deferred();

		/*------------------------------------------------------------------------------------------------------------*/

		try
		{
			this._client.disconnect();

			result.resolve(this._uuid);
		}
		catch(errorMessage)
		{
			result.resolve(errorMessage);
		}

		/*------------------------------------------------------------------------------------------------------------*/

		return result.promise();
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Get the client UUID
	  * @returns {String} The client UUID
	  */

	getUUID()
	{
		return this._uuid;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Get the endpoint
	  * @returns {String} The endpoint
	  */

	getEndpoint()
	{
		return this._endpoint;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Get the username
	  * @returns {String} The username
	  */

	getUsername()
	{
		return this._username;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Subscribe a MQTT topic
	  * @param {String} topic the topic
	  * @param {Object} [options] dictionary of optional parameters (qos=0,1,2, timeout [ms])
	  * @returns {$.Deferred} A JQuery deferred object
	  */

	subscribe(topic, options)
	{
		options = options || {};

		const result = $.Deferred();

		this._client.subscribe(
			topic,
			{
				qos: options.qos || 0,
				timeout: options.timeout || 10000,
				/**/
				onSuccess: () => { result.resolve(); },
				onFailure: (x, y, errorMessage) => { result.reject(errorMessage); },
			}
		);

		return result.promise();
	} 

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Unsubscribe a MQTT topic
	  * @param {String} topic the topic
	  * @param {Object} [options] dictionary of optional parameters (qos=0,1,2, timeout [ms])
	  * @returns {$.Deferred} A JQuery deferred object
	  */

	unsubscribe(topic, options)
	{
		options = options || {};

		const result = $.Deferred();

		this._client.unsubscribe(
			topic,
			{
				qos: options.qos || 0,
				timeout: options.timeout || 10000,
				/**/
				onSuccess: () => { result.resolve(); },
				onFailure: (x, y, errorMessage) => { result.reject(errorMessage); },
			}
		);

		return result.promise();
	} 

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Sends a MQTT message
	  * @param {String} topic the topic
	  * @param {String} payload the payload
	  * @param {Object} [options] dictionary of optional parameters (qos=0,1,2, retained=true,false)
	  * @returns {$.Deferred} A JQuery deferred object
	  */

	send(topic, payload, options)
	{
		options = options || {};

		/*------------------------------------------------------------------------------------------------------------*/

		const token = this.#cnt++;

		/*------------------------------------------------------------------------------------------------------------*/

		const message = new Paho.Message(payload);

		message.token    = token;
		message.topic    = topic;
		message.qos      = options.qos      || 0x000;
		message.retained = options.retained || false;

		/*------------------------------------------------------------------------------------------------------------*/

		this._client.send(message);

		/*------------------------------------------------------------------------------------------------------------*/

		return $.Deferred().resolve(token).promise();

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Executes an AMI command
	  * @param {String} command the AMI command
	  * @param {Object} [options] dictionary of optional parameters (serverName, converter, timeout [ms])
	  * @returns {$.Deferred} A JQuery deferred object
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

			return `-${y}="${String(params.shift()).replace('\\', '\\\\').replace('\n', '\\n').replace('"', '\\"').replace('\'', '\\\'')}"`;
		});

		/*------------------------------------------------------------------------------------------------------------*/

		const topic = `ami/${serverName}/command/${converter}`;

		const message = new Paho.Message(`AMI-COMMAND<${token},"${this._uuid}","${this._username}">${command}`);

		message.token    = token;
		message.topic    = topic;
		message.qos      = options.qos      || 0x000;
		message.retained = options.retained || false;

		/*------------------------------------------------------------------------------------------------------------*/

		this._client.send(message);

		/*------------------------------------------------------------------------------------------------------------*/

		const result = this.#L[token] = $.Deferred();

		/*------------------------------------------------------------------------------------------------------------*/

		setTimeout(() => {

			if(token in this.#L)
			{
				this.#L[token].reject('timeout', token);

				delete this.#L[token];
			}

		}, options.timeout || 10000);

		/*------------------------------------------------------------------------------------------------------------*/

		return result.promise();

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	/**
	  * Finds data within the given JSON, see {@link https://github.com/dfilatov/jspath}
	  * @param {String} path the path
	  * @param {Object} json the JSON
	  * @returns {Array} The resulting array
	  */

	jspath(path, json)
	{
		return JSPath.apply(path, json);
	}

	/*----------------------------------------------------------------------------------------------------------------*/
	/* CALLBACKS                                                                                                      */
	/*----------------------------------------------------------------------------------------------------------------*/

	#onConnected(reconnect, serverURL)
	{
		/*------------------------------------------------------------------------------------------------------------*/

		if(reconnect) {
			console.log(`onConnected: client \`${this._uuid}\` reconnected to server URL \`${serverURL}\``);
		}
		else {
			console.log(`onConnected: client \`${this._uuid}\` connected to server URL \`${serverURL}\``);
		}

		/*------------------------------------------------------------------------------------------------------------*/

		this.subscribe(this._uuid).always(() => {

			if(this._userOnConnected)
			{
				this._userOnConnected(reconnect, serverURL);
			}
		});

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	#onConnectionLost(responseObject)
	{
		if(responseObject.errorCode !== 0)
		{
			console.log(`onConnectionLost: client \`${this._uuid}\` disconnected, cause: ${responseObject.errorMessage}`);

			if(this._userOnConnectionLost)
			{
				this._userOnConnectionLost(responseObject.errorMessage);
			}
		}
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	#onMessageArrived(message)
	{
		const topic = message.topic;
		const payload = message.payloadString;

		const m = payload.match(this.#responseRegExp);

		if(topic === this._uuid && m)
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
					const json = JSON.parse(data);

					const info = JSPath.apply('.AMIMessage.info.$', json);
					const error = JSPath.apply('.AMIMessage.error.$', json);

					if(error.length === 0)
					{
						this.#L[token].resolve(json, info.join('. '), token);
					}
					else
					{
						this.#L[token].reject(json, error.join('. '), token);
					}
				}
				else
				{
					this.#L[token].resolve(data, '', token);
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
				this._userOnMessageArrived(topic, payload);
			}

			/*--------------------------------------------------------------------------------------------------------*/
		}
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	#onMessageDelivered(message)
	{
		if(this._userOnMessageDelivered)
		{
			this._userOnMessageDelivered(message.token);
		}
	}

	/*----------------------------------------------------------------------------------------------------------------*/
}

/*--------------------------------------------------------------------------------------------------------------------*/
/* BROWSER SUPPORT                                                                                                    */
/*--------------------------------------------------------------------------------------------------------------------*/

if(typeof window !== 'undefined') window.AMIMQTTClient = AMIMQTTClient;

/*--------------------------------------------------------------------------------------------------------------------*/

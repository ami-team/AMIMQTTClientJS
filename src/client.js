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
};

/*--------------------------------------------------------------------------------------------------------------------*/
/* CLIENT                                                                                                             */
/*--------------------------------------------------------------------------------------------------------------------*/

export default class AMIMQTTClient
{
	/*----------------------------------------------------------------------------------------------------------------*/
	/* VARIABLES                                                                                                      */
	/*----------------------------------------------------------------------------------------------------------------*/

	_L = {};

	_cnt = 0x01;

	_converter = 'AMIXmlToJson.xsl';

	_paramRegExp = new RegExp('-\\W*([a-zA-Z][a-zA-Z0-9]*)\\W*=\\W*\\?', 'g');

	_responseRegExp = new RegExp('AMI-RESPONSE<([0-9]+),(true|false)>(.*)', 's');

	/*----------------------------------------------------------------------------------------------------------------*/
	/* METHODS                                                                                                        */
	/*----------------------------------------------------------------------------------------------------------------*/

	constructor(endpoint, username, password, serverName, options)
	{
		serverName = serverName || '';

		options = options || {};

		/*------------------------------------------------------------------------------------------------------------*/

		const uuid = parseJwt(password).uuid || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {

			const r = 16 * Math.random(), v = (c == 'x') ? (r | 0x000000000) : (r & 0x03 | 0x08);

			return v.toString(16);
		});

		/*------------------------------------------------------------------------------------------------------------*/

		this._uuid = uuid;

		this._endpoint = endpoint;

		this._username = username;

		this._serverName = serverName;

		/*------------------------------------------------------------------------------------------------------------*/

		this._userOnSuccess          = options.onSuccess          || null;
		this._userOnFailure          = options.onFailure          || null;
		this._userOnConnected        = options.onConnected        || null;
		this._userOnConnectionLost   = options.onConnectionLost   || null;
		this._userOnMessageArrived   = options.onMessageArrived   || null;
		this._userOnMessageDelivered = options.onMessageDelivered || null;

		/*------------------------------------------------------------------------------------------------------------*/

		const url = new URL(endpoint);

		/*------------------------------------------------------------------------------------------------------------*/

		this._client = new Paho.Client(url.hostname, parseInt(url.port || '443'), url.pathname, uuid);

		/*------------------------------------------------------------------------------------------------------------*/

		this._client.onConnected        = (...args) => this._onConnected       .apply(this, args);
		this._client.onConnectionLost   = (...args) => this._onConnectionLost  .apply(this, args);
		this._client.onMessageArrived   = (...args) => this._onMessageArrived  .apply(this, args);
		this._client.onMessageDelivered = (...args) => this._onMessageDelivered.apply(this, args);

		/*------------------------------------------------------------------------------------------------------------*/

		this._client.connect({
			useSSL: url.protocol === 'wss:',
			userName: username,
			password: password,
			reconnect: true,
			/**/
			onSuccess: (...args) => this._onSuccess.apply(this, args),
			onFailure: (...args) => this._onFailure.apply(this, args),
		});

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	getUUID()
	{
		return this._uuid;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	getEndpoint()
	{
		return this._endpoint;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	getUsername()
	{
		return this._username;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

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
				onFailure: (_, errorCode, errorMessage) => { result.reject(errorCode, errorMessage); },
			}
		);

		return result.promise();
	} 

	/*----------------------------------------------------------------------------------------------------------------*/

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
				onFailure: (_, errorCode, errorMessage) => { result.reject(errorCode, errorMessage); },
			}
		);

		return result.promise();
	} 

	/*----------------------------------------------------------------------------------------------------------------*/

	send(topic, payload, options)
	{
		options = options || {};

		/*------------------------------------------------------------------------------------------------------------*/

		const token = this._cnt++;

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

	execute(command, options)
	{
		options = options || {};

		/*------------------------------------------------------------------------------------------------------------*/

		const token = this._cnt++;

		/*------------------------------------------------------------------------------------------------------------*/

		const params = options.params || [];

		/*------------------------------------------------------------------------------------------------------------*/

		const serverName = ('serverName' in options) ? (options.serverName || this._serverName) : this._serverName;

		const converter = ('converter' in options) ? (options.converter || /*--*/ '' /*--*/) : this._converter;

		/*------------------------------------------------------------------------------------------------------------*/

		command = (command || '').trim().replace(this._paramRegExp, (x, y) => {

			return `-${y}="${String(params.shift()).replace('\\', '\\\\').replace('\n', '\\n').replace('"', '\\"').replace("'", "\\'")}"`;
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

		const result = this._L[token] = $.Deferred();

		/*------------------------------------------------------------------------------------------------------------*/

		setTimeout(() => {

			if(token in this._L)
			{
				this._L[token].reject('timeout', token);

				delete this._L[token];
			}

		}, options.timeout || 10000);

		/*------------------------------------------------------------------------------------------------------------*/

		return result.promise();

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	jspath(path, json)
	{
		return JSPath.apply(path, json);
	}

	/*----------------------------------------------------------------------------------------------------------------*/
	/* CALLBACKS                                                                                                      */
	/*----------------------------------------------------------------------------------------------------------------*/

	_onSuccess()
	{
		if(this._userOnSuccess)
		{
			this._userOnSuccess(this._uuid);
		}
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	_onConnected(reconnect, serverURL)
	{
		/*------------------------------------------------------------------------------------------------------------*/

		if(reconnect) {
			console.log(`onConnected: client \`${this._uuid}\` reconnected to server URL \`${serverURL}\``);
		}
		else {
			console.log(`onConnected: client \`${this._uuid}\` connected to server URL \`${serverURL}\``);
		}

		/*------------------------------------------------------------------------------------------------------------*/

		this.subscribe(this._uuid).done(() => {

			if(this._userOnConnected)
			{
				this._userOnConnected(reconnect, serverURL);
			}

		}).fail((errorCode, errorMessage) => {

			this._onFailure({
				errorCode: errorCode,
				errorMessage: errorMessage,
			});
		});

		/*------------------------------------------------------------------------------------------------------------*/
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	_onFailure(responseObject)
	{
		if(responseObject.errorCode !== 0)
		{
			console.log(`onFailure: client \`${this._uuid}\` rejected, cause: ${responseObject.errorMessage}`);
		}

		if(this._userOnFailure)
		{
			this._userOnFailure(errorCode, errorMessage);
		}
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	_onConnectionLost(responseObject)
	{
		if(responseObject.errorCode !== 0)
		{
			console.log(`onConnectionLost: client \`${this._uuid}\` disconnected, cause: ${responseObject.errorMessage}`);
		}

		if(this._userOnConnectionLost)
		{
			this._userOnConnectionLost(errorCode, errorMessage);
		}
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	_onMessageArrived(message)
	{
		const topic = message.topic;
		const payload = message.payloadString;

		const m = payload.match(this._responseRegExp);

		if(topic === this._uuid && m)
		{
			/*--------------------------------------------------------------------------------------------------------*/
			/* AMI COMMAND RESULT MESSAGE                                                                             */
			/*--------------------------------------------------------------------------------------------------------*/

			const token = parseInt(m[1]);

			const json = /*----*/(m[2]);

			const data = /*---*/(m[3]);

			/*--------------------------------------------------------------------------------------------------------*/

			if(token in this._L)
			{
				if(json === 'true')
				{
					const json = JSON.parse(data);

					const info = JSPath.apply('.AMIMessage.info.$', json);
					const error = JSPath.apply('.AMIMessage.error.$', json);

					if(error.length === 0)
					{
						this._L[token].resolve(json, info.join('. '), token);
					}
					else
					{
						this._L[token].reject(json, error.join('. '), token);
					}
				}
				else
				{
					this._L[token].resolve(data, '', token);
				}

				delete this._L[token];
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

	_onMessageDelivered(message)
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

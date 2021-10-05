/*--------------------------------------------------------------------------------------------------------------------*/

import Paho from 'paho-mqtt';

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

	_responseRegExp = new RegExp('AMI-RESPONSE<([0-9]+),(true|false)>(.*)', 's');

	/*----------------------------------------------------------------------------------------------------------------*/
	/* METHODS                                                                                                        */
	/*----------------------------------------------------------------------------------------------------------------*/

	constructor(useSSL, host, port, path, username, password, serverName, options)
	{
		options = options || {};

		/*------------------------------------------------------------------------------------------------------------*/

		const uuid = parseJwt(password).uuid || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {

			const r = 16 * Math.random(), v = (c == 'x') ? (r | 0x000000000) : (r & 0x03 | 0x08);

			return v.toString(16);
		});

		/*------------------------------------------------------------------------------------------------------------*/

		this._uuid = uuid;

		this._serverName = serverName;

		/*------------------------------------------------------------------------------------------------------------*/

		this._userOnSuccess          = options.onSuccess          || null;
		this._userOnFailure          = options.onFailure          || null;
		this._userOnConnected        = options.onConnected        || null;
		this._userOnConnectionLost   = options.onConnectionLost   || null;
		this._userOnMessageArrived   = options.onMessageArrived   || null;
		this._userOnMessageDelivered = options.onMessageDelivered || null;

		/*------------------------------------------------------------------------------------------------------------*/

		this._client = new Paho.Client(host, port, path, this._uuid);

		/*------------------------------------------------------------------------------------------------------------*/

		this._client.onConnected        = (...args) => this._onConnected       .apply(this, args);
		this._client.onConnectionLost   = (...args) => this._onConnectionLost  .apply(this, args);
		this._client.onMessageArrived   = (...args) => this._onMessageArrived  .apply(this, args);
		this._client.onMessageDelivered = (...args) => this._onMessageDelivered.apply(this, args);

		/*------------------------------------------------------------------------------------------------------------*/

		this._client.connect({
			useSSL: useSSL,
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

	getUser()
	{
		return this._user;
	}

	/*----------------------------------------------------------------------------------------------------------------*/

	getUUID()
	{
		return this._uuid;
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

		const topic = `ami/${this._serverName}/command/${'converter' in options ? options.converter || '': 'AMIXmlToJson.xsl'}`;

		const message = new Paho.Message(`AMI-COMMAND<${token},"${this._user}","${this._uuid}">${command}`);

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

	_onConnected(reconnect, uri)
	{
		/*------------------------------------------------------------------------------------------------------------*/

		if(reconnect) {
			console.log(`onConnected: client \`${this._uuid}\` reconnected to server URI \`${uri}\``);
		}
		else {
			console.log(`onConnected: client \`${this._uuid}\` connected to server URI \`${uri}\``);
		}

		/*------------------------------------------------------------------------------------------------------------*/

		this.subscribe(this._uuid).done(() => {

			if(this._userOnConnected)
			{
				this._userOnConnected(reconnect, uri);
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

			const data = /*----*/(m[3]);

			/*--------------------------------------------------------------------------------------------------------*/

			if(token in this._L)
			{
				this._L[token].resolve(data, token);

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

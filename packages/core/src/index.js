import PluginRepository from './plugins/PluginRepository';
import SocketService from './services/SocketService';
import Plugin from './plugins/Plugin';
import * as PluginTypes from './plugins/PluginTypes';
import { Blockchains } from './models/Blockchains';
import Network from './models/Network';

let origin;

const throwNoAuth = () => {
    if(!holder.scatter.isExtension && !SocketService.isConnected())
        throw new Error('Connect and Authenticate first - scatter.connect( pluginName )');
};

const checkForExtension = (resolve, tries = 0) => {
    if(tries > 20) return;
    if(holder.scatter.isExtension) return resolve(true);
    setTimeout(() => checkForExtension(resolve, tries + 1), 100);
};


class Index {

    constructor(){
        this.isExtension = false;
        this.identity = null;
    }

	loadPlugin(plugin){
		const noIdFunc = () => { if(!this.identity) throw new Error('No Identity') };
    	if(!plugin.isValid()) throw new Error(`${plugin.name} doesn't seem to be a valid ScatterJS plugin.`);

		PluginRepository.loadPlugin(plugin);

		if(plugin.isSignatureProvider()){
            this[plugin.name] = plugin.signatureProvider(noIdFunc, () => this.identity);
            this[plugin.name+'Hook'] = plugin.hookProvider;
        }
	}

    async connect(pluginName, options){
        return new Promise(resolve => {
            if(!pluginName || !pluginName.length) throw new Error("You must specify a name for this connection");

            // Setting options defaults
            options = Object.assign({initTimeout:10000, linkTimeout:30000}, options);

            // Auto failer
            setTimeout(() => {
                resolve(false);
            }, options.initTimeout);

            // Defaults to scatter extension if exists
            checkForExtension(resolve);

            // Tries to set up Desktop Connection
            SocketService.init(pluginName, options.linkTimeout);
            SocketService.link().then(async authenticated => {
                if(!authenticated) return false;
                this.identity = await this.getIdentityFromPermissions();
                return resolve(true);
            });
        })
    }

    disconnect(){
        return SocketService.disconnect();
    }

    isConnected(){
        return SocketService.isConnected();
    }

    isPaired(){
        return SocketService.isPaired();
    }

    getVersion(){
        return SocketService.sendApiRequest({
            type:'getVersion',
            payload:{}
        });
    }

	/***
     * Logs a user into your application
	 * @param requiredFields
	 * @returns {Promise<any>}
	 */
	login(requiredFields){
	    throwNoAuth();
	    return SocketService.sendApiRequest({
		    type:'getOrRequestIdentity',
		    payload:{
			    fields:requiredFields
		    }
	    }).then(id => {
		    if(id) this.identity = id;
		    return id;
	    });
    }

	/***
     * Check is a user is logged in by tapping
     * their Scatter, but does not issue a popup
	 * @returns {Promise<any>}
	 */
	checkLogin(){
	    throwNoAuth();
	    return SocketService.sendApiRequest({
		    type:'identityFromPermissions',
		    payload:{}
	    }).then(id => {
		    if(id) this.identity = id;
		    return id;
	    });
    }

	/***
     * Logs a user out of your application.
	 * @returns {Promise<any>}
	 */
	logout(){
	    throwNoAuth();
	    return SocketService.sendApiRequest({
		    type:'forgetIdentity',
		    payload:{}
	    }).then(res => {
		    this.identity = null;
		    return res;
	    });
    }

	/***
	 * Authenticates a user's login using
	 * asymmetric encryption.
	 * @param nonce
	 * @param data - Optional data to sign ( fallback to appkey/origin )
	 * @param publicKey - Optional key to use ( fallback to identity key )
	 */
	authenticate(nonce, data = null, publicKey = null){
        throwNoAuth();
        return SocketService.sendApiRequest({
            type:'authenticate',
            payload:{ nonce, data, publicKey }
        });
    }




    getArbitrarySignature(publicKey, data){
        throwNoAuth();
        return SocketService.sendApiRequest({
            type:'requestArbitrarySignature',
            payload:{
                publicKey,
                data
            }
        });
    }


    getPublicKey(blockchain){
        throwNoAuth();
        return SocketService.sendApiRequest({
            type:'getPublicKey',
            payload:{ blockchain }
        });
    }

    linkAccount(account, network){
        throwNoAuth();
        return SocketService.sendApiRequest({
            type:'linkAccount',
            payload:{ account, network }
        });
    }

    hasAccountFor(network){
        throwNoAuth();
        return SocketService.sendApiRequest({
            type:'hasAccountFor',
            payload:{
                network
            }
        });
    }

    suggestNetwork(network){
        throwNoAuth();
        return SocketService.sendApiRequest({
            type:'requestAddNetwork',
            payload:{
                network
            }
        });
    }

    requestTransfer(network, to, amount, options = {}){
        const payload = {network, to, amount, options};
        return SocketService.sendApiRequest({
            type:'requestTransfer',
            payload
        });
    }

    requestSignature(payload){
        throwNoAuth();
        return SocketService.sendApiRequest({
            type:'requestSignature',
            payload
        });
    }

    createTransaction(blockchain, actions, account, network){
        throwNoAuth();
        return SocketService.sendApiRequest({
            type:'createTransaction',
            payload:{
                blockchain,
                actions,
                account,
                network
            }
        });
    }



    /******************************/
    /******** DEPRECATED **********/
    /******************************/

    // @deprecated - Use `login(requiredFields)`
	getIdentity(requiredFields){
		return this.login(requiredFields);
	}

	// @deprecated - Use `checkLogin()`
	getIdentityFromPermissions(){
		return this.checkLogin();
	}

	// @deprecated - Use `logout()`
	forgetIdentity(){
		return this.logout();
	}

}


class Holder {
    constructor(_scatter){
        this.scatter = _scatter;
    }

	plugins(...plugins) {
		if (!this.scatter.isExtension) {
			plugins.map(plugin => this.scatter.loadPlugin(plugin));
		}
	}
}


let holder = new Holder(new Index());
if(typeof window !== 'undefined') {

    // Catching extension instead of Desktop
    if(typeof document !== 'undefined'){
        const bindScatterClassic = () => {
            holder.scatter = window.scatter;
            holder.scatter.isExtension = true;
            holder.scatter.connect = () => new Promise(resolve => resolve(true));
        };

        if(typeof window.scatter !== 'undefined') bindScatterClassic();
        else document.addEventListener('scatterLoaded', () => bindScatterClassic());
    }

    window.ScatterJS = holder;
}

holder.Plugin = Plugin;
holder.PluginTypes = PluginTypes;
holder.Blockchains = Blockchains;
holder.Network = Network;
holder.SocketService = SocketService;
export {Plugin, PluginTypes, Blockchains, Network, SocketService};
export default holder;



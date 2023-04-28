import * as sjcl from 'sjcl-all';

export default class KPHEncryption
{
    constructor(private _key: string)
    {

    }

    /** Encrypt the data we want to send */
    encryptData(data: string, nonce: string)
    {
        const encrypted = sjcl.mode.cbc.encrypt(
            new sjcl.cipher.aes(sjcl.codec.base64.toBits(this._key as string)),
            sjcl.codec.utf8String.toBits(data),
            sjcl.codec.base64.toBits(nonce)
        );
        
        return sjcl.codec.base64.fromBits(encrypted);
    }

    /** Decrypt the data we received */
    decryptData(data: string, nonce: string)
    {
        const decrypted = sjcl.mode.cbc.decrypt(
            new sjcl.cipher.aes(sjcl.codec.base64.toBits(this._key as string)),
            sjcl.codec.base64.toBits(data),
            sjcl.codec.base64.toBits(nonce)
        );
        
        return sjcl.codec.utf8String.fromBits(decrypted);
    }

    /** Validate the verifier string */
    verify(verifier: string, nonce: string): boolean
    {
        const decrypted = this.decryptData(verifier, nonce);

        return (decrypted === nonce);
    }

    /** Generate verifier string */
    generateVerifier(nonce: string): string
    {
        return this.encryptData(nonce, nonce);
    }

    /** Generate a (128bit) Nonce, base64 encoded */
    generateNonce(): string
    {
        let key = '';
        for(let i=0; i<16; i++)
            key += String.fromCharCode(Math.floor(Math.random()*256)); // Random char from char 0 to 255

        return Buffer.from(key, 'binary').toString('base64');
    }

}

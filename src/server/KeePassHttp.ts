import { log } from "../classes";
import { Server, Setup, Request, Response, KPHEncryption } from ".";

export type RequestType = 'test-associate' | 'associate' | 'get-logins' | 'get-logins-count' | 'set-login';

export interface IRequestBodyBase
{
    RequestType: RequestType;
    /** Key id entered into KeePass GUI while `associate` */
    Id: string;
    /** 128 bit (16 bytes) long random vector, base64 encoded, used as IV for aes encryption */
    Nonce: string;
    /** ENCRYPTED: verifier, base64 encoded AES encrypted data: `encrypt(base64_encode($nonce), $key, $nonce);` */
    Verifier: string;
}

export interface IRequestBodyTestAssociate extends IRequestBodyBase
{
    RequestType: 'test-associate',
}

export interface IRequestBodyAssociate extends Omit<IRequestBodyBase, 'Id'>
{
    RequestType: 'associate',
    /** Base64 encoded 256bit key */
    Key: string;
}

export interface IRequestBodyGetLogins extends IRequestBodyBase
{
    RequestType: 'get-logins',
    /** ENCRYPTED: URL for getting or setting logins (will be encrypted before sending) */
    Url: string;
    /** ENCRYPTED: Submit URL for getting or setting logins (will be encrypted before sending) */
    SubmitUrl?: string;
}

export type IRequestBody = IRequestBodyTestAssociate | IRequestBodyAssociate | IRequestBodyGetLogins;

export interface IEntry
{
    /** ENCRYPTED: Login name */
    Login: string;
    /** ENCRYPTED: Item name */
    Name: string;
    /** ENCRYPTED: Password */
    Password: string;
    /** ENCRYPTED: Field names? We don't use this */
    StringFields: string | null;
    /** ENCRYPTED: UUID */
    Uuid: string;
}

export interface IResponseBody
{
    /** Number of logins when RequestType is `get-logins-count` */
    Count: number | null;
    /** Found entries when RequestType is `get-logins` */
    Entries?: IEntry[] | null;
    /** Returned error message */
    Error?: string;
    Hash: string;
    /** Key id entered into KeePass GUI while `associate` */
    Id: string;
    Nonce: string;
    /** The RequestType we send */
    RequestType: RequestType;
    /** Was the request successful or not? */
    Success: boolean;
    Verifier?: string;
    /** KeePassHttp version */
    Version: string;
}

export interface IAssociationProps
{
    Key: string;
}

export default class KeePassHttp
{
    static #associations: Record<string, IAssociationProps> = {};

    static async handleRequest(req: Request, res: Response, json: IRequestBody)
    {
        let requestHandler: (()=>Promise<IResponseBody>) | undefined;

        switch(json.RequestType)
        {
            case 'test-associate':
                requestHandler = ()=>this.testAssociate(json);
                break;
            case 'associate':
                requestHandler = ()=>this.associate(json);
                break;
            case 'get-logins':
                requestHandler = ()=>this.getLogins(json);
                break;
        }

        try {
            if(requestHandler)
            {
                const response = await requestHandler();
                Server.sendResponse(res, response);
            }
            else
                throw new Error(`Unsupported RequestType "${(<IRequestBodyBase>json).RequestType}"`);

        } catch(error) {
            log('error', `Request "${json.RequestType}" returned an error: ${String(error)}`);
            // Send error
            Server.sendResponse(res, this.#generateResponse({
                Id: (<any>json).Id,
                RequestType: json.RequestType,
                Error: String(error),
            }));
        }

    }

    static #generateResponse(props: Partial<IResponseBody> & Pick<IResponseBody, 'RequestType'>): IResponseBody
    {
        return {
            ...{
                Count: null,
                Entries: null,
                Error: '',
                Hash: '',
                Id: '',
                Nonce: '',
                Success: false,
                Verifier: '',
                Version: 'Mock-KeePassHttp',
            },
            ...props
        };
    }

    static async associate(req: IRequestBodyAssociate): Promise<IResponseBody>
    {
        const encryption = new KPHEncryption(req.Key);

        // Validate verifier
        if(!encryption.verify(req.Verifier, req.Nonce))
            throw 'Invalid verifier';

        const id = `Mock-KPH-${(new Date().toISOString())}`; // Generate an ID
        this.#associations[id] = {Key: req.Key};

        const nonce = encryption.generateNonce();

        log('info', `"${id}" associated`);

        return this.#generateResponse({
            Id: id,
            Nonce: nonce,
            RequestType: req.RequestType,
            Success: true,
            Verifier: encryption.generateVerifier(nonce),
        });
    }

    static async testAssociate(req: IRequestBodyTestAssociate): Promise<IResponseBody>
    {
        const {encryption} = this.verifyRequest(req);

        const nonce = encryption.generateNonce();
        return this.#generateResponse({
            Id: req.Id,
            Nonce: nonce,
            RequestType: req.RequestType,
            Success: true,
            Verifier: encryption.generateVerifier(nonce),
        });
    }

    static async getLogins(req: IRequestBodyGetLogins): Promise<IResponseBody>
    {
        const {encryption} = this.verifyRequest(req);

        const decryptedUrl = encryption.decryptData(req.Url, req.Nonce);
        const logins = Setup.getLogins(decryptedUrl) || [];

        const nonce = encryption.generateNonce();
        return this.#generateResponse({
            Id: req.Id,
            Nonce: nonce,
            RequestType: req.RequestType,
            Success: true,
            Verifier: encryption.generateVerifier(nonce),
            Count: logins.length,
            Entries: logins.map(login=>({
                Name: encryption.encryptData(login.name, nonce),
                Login: encryption.encryptData(login.username, nonce),
                Password: encryption.encryptData(login.password, nonce),
                StringFields: null,
                Uuid: encryption.encryptData(login.uuid, nonce),
            })),
        });
    }

    static verifyRequest(req: IRequestBody)
    {
        if(!('Id' in req)) throw 'No Id supplied';

        const association = this.#associations[req.Id];

        if(!association) // There's no association for the supplied Id?
            throw 'Unknown Id';

        const encryption = new KPHEncryption(association.Key);
        
        // Validate verifier
        if(!encryption.verify(req.Verifier, req.Nonce))
            throw 'Invalid verifier';

        return {
            association,
            encryption,
        };
    }

    static getAssociation(id: string): IAssociationProps | undefined
    {
        return this.#associations[id];
    }

    static clearAssociations()
    {
        this.#associations = {};
    }
}

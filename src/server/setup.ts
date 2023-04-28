import { log } from '../classes';
import { Server, Request, Response, KeePassHttp } from '.';

export interface ISetup
{
    /** Clear all previous settings */
    clear?: boolean;
    logins?: ISetupLogins[];
}

export interface ISetupLogins
{
    url: string;
    logins: ILogin[],
}

export interface ILogin
{
    username: string;
    password: string;
    name: string;
    uuid: string;
}

export default class Setup
{
    static #logins: Record<string, ILogin[]> = {};

    static async handleRequest(req: Request, res: Response, json: ISetup)
    {
        if(json.clear)
        {
            this.clear();
        }

        // We've received logins to add?
        if(json.logins)
        {
            log('verbose', `Setup: Set ${json.logins.length} logins`);
            this.addLogins(json.logins);
        }

        Server.sendResponse(res, {});
    }

    static clear()
    {
        log('verbose', 'Setup: Clear current setup');
        KeePassHttp.clearAssociations();
        this.#logins = {};
    }

    static addLogins(logins: ISetupLogins[])
    {
        for(const login of logins)
        {
            const parsedUrl = new URL(login.url);
            this.#logins[parsedUrl.host] = login.logins;
        }
    }

    static getLogins(url: string): ILogin[] | undefined
    {
        const parsedUrl = new URL(url);
        return this.#logins[parsedUrl.host];
    }
}

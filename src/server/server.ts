import http from 'http';
import sjcl from 'sjcl-all';
import { log } from '../classes';
import { KeePassHttp, Setup }  from '.';

export type Request = http.IncomingMessage;
export type Response = http.ServerResponse<http.IncomingMessage> & {req: http.IncomingMessage};

export default class Server
{
    #server: http.Server;

    constructor(public readonly port: number = 19455)
    {
        // Enable CBC mode
        (sjcl as any).beware["CBC mode is dangerous because it doesn't protect message integrity."]();

        this.#server = http.createServer(this.#listener.bind(this));
    }

    start(): Promise<void>
    {
        return new Promise<void>((resolve, reject)=>{
            const server = this.#server.listen(this.port);
            server.on('listening', ()=>{
                log('info', `Server started on http://localhost:${this.port}`);
                resolve();
            });
            server.on('error', reject);
        });
    }

    stop()
    {
        this.#server.close();
    }

    #listener(req: Request, res: Response)
    {
        if(req.method !== 'POST')
        {
            log('error', 'We received a request that\'s not a POST');
            res.statusCode = 401;
            res.end();
        }
        else
        {
            let body = '';
            req.on('data', data=>body+=data); // Collect incoming data
            req.on('end', ()=>{
                try {
                    const json = JSON.parse(body);
                    if(req.url === '/setup')
                        Setup.handleRequest(req, res, json);
                    else
                        KeePassHttp.handleRequest(req, res, json);
                } catch(error) {
                    res.statusCode = 401;
                    res.end('Body doesn\'t contain valid JSON data');
                    log('error', 'JSON parse error:', error);
                }
            });
        }
    }

    static sendResponse(res: Response, body: any)
    {
        if(res.writable)
            res.end(JSON.stringify(body));
    }

}

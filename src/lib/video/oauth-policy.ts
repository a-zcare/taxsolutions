import {timingSafeEqual} from 'node:crypto';
type Flow={provider:string;browserHash:string;expiresAt:Date;staffId:string;sessionHash:string};
type Session={id:string;staffId:string;expiresAt:Date;staff:{active:boolean}};
export function assertOAuthBinding(flow:Flow|null,browserHash:string,provider:string,session:Session|null,now=new Date()){
 const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
 if(!flow||flow.provider!==provider||flow.expiresAt<=now||!equal(flow.browserHash,browserHash)||!session||session.id!==flow.sessionHash||session.staffId!==flow.staffId||session.expiresAt<=now||!session.staff.active)throw Error('UNAUTHORIZED');
}

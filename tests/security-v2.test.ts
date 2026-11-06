import {describe,it,expect,beforeEach,afterEach} from 'vitest';import {randomBytes} from 'node:crypto';
import {seal,unseal,totp,verifyTotp} from '../src/lib/v2/crypto';import {assertAssigned,assertManager,assertOwner,clientScope,taskScope,bookingScope,type Actor} from '../src/lib/v2/policy';import {assertOAuthBinding} from '../src/lib/video/oauth-policy';
const original=process.env.DATA_ENCRYPTION_KEY;
beforeEach(()=>{process.env.DATA_ENCRYPTION_KEY=randomBytes(32).toString('base64')});afterEach(()=>{if(original===undefined)delete process.env.DATA_ENCRYPTION_KEY;else process.env.DATA_ENCRYPTION_KEY=original});
const accountant:Actor={id:'accountant-a',role:'ACCOUNTANT',name:'Synthetic A',email:'synthetic@example.invalid',locale:'en'};
describe('Secret encryption and MFA',()=>{
 it('encrypts with fresh nonces and authenticates context and ciphertext',()=>{const a=seal('synthetic-token','oauth:a'),b=seal('synthetic-token','oauth:a');expect(a).not.toBe(b);expect(a).not.toContain('synthetic-token');expect(unseal(a,'oauth:a')).toBe('synthetic-token');expect(()=>unseal(a,'oauth:b')).toThrow();const chunks=a.split('.');const bytes=Buffer.from(chunks[3],'base64url');bytes[0]^=1;chunks[3]=bytes.toString('base64url');expect(()=>unseal(chunks.join('.'),'oauth:a')).toThrow()});
 it('fails closed without a valid encryption key',()=>{delete process.env.DATA_ENCRYPTION_KEY;expect(()=>seal('test','test')).toThrow('ENCRYPTION_KEY_REQUIRED')});
 it('matches RFC 6238 and rejects replay and invalid codes',()=>{const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';expect(totp(secret,59000,8)).toBe('94287082');expect(verifyTotp(secret,'287082',-1n,59000)).toBe(1n);expect(verifyTotp(secret,'287082',1n,59000)).toBeNull();expect(verifyTotp(secret,'000000',-1n,59000)).toBeNull();expect(verifyTotp(secret,'invalid',-1n,59000)).toBeNull()});
});
describe('RBAC and object scopes',()=>{
 it('hides other accountants objects and manager-only operations',()=>{expect(()=>assertAssigned(accountant,'accountant-b')).toThrow('NOT_FOUND');expect(()=>assertAssigned(accountant,null)).toThrow('NOT_FOUND');expect(()=>assertManager(accountant)).toThrow('FORBIDDEN');expect(()=>assertOwner({...accountant,role:'ADMIN'})).toThrow('FORBIDDEN');expect(()=>assertAssigned(accountant,accountant.id)).not.toThrow();expect(()=>assertAssigned({...accountant,role:'OWNER'},'other')).not.toThrow()});
 it('applies restrictive scopes before database reads',()=>{expect(taskScope(accountant)).toEqual({assignedId:accountant.id});expect(bookingScope(accountant)).toEqual({staffId:accountant.id});expect(clientScope(accountant)).toHaveProperty('OR');expect(taskScope({...accountant,role:'ADMIN'})).toEqual({})});
});
describe('OAuth state/session binding',()=>{
 const now=new Date('2026-01-01T12:00Z');const flow={provider:'google',browserHash:'a'.repeat(64),expiresAt:new Date(now.getTime()+1000),staffId:'a',sessionHash:'session'};const session={id:'session',staffId:'a',expiresAt:new Date(now.getTime()+1000),staff:{active:true}};
 it('requires browser cookie, correct provider and a live matching staff session',()=>{expect(()=>assertOAuthBinding(flow,'a'.repeat(64),'google',session,now)).not.toThrow();for(const [f,b,p,s]of [[flow,'b'.repeat(64),'google',session],[flow,'a'.repeat(64),'zoom',session],[{...flow,expiresAt:now},'a'.repeat(64),'google',session],[flow,'a'.repeat(64),'google',{...session,staffId:'b'}],[flow,'a'.repeat(64),'google',{...session,staff:{active:false}}]] as const)expect(()=>assertOAuthBinding(f,b,p,s,now)).toThrow('UNAUTHORIZED')});
});

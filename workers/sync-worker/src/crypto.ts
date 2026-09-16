import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const key = createHash('sha256').update(process.env.JWT_SECRET ?? 'development-only-change-me').digest();
export function decryptSecret(value:string){const [iv,tag,data]=value.split(':');if(!iv||!tag||!data)throw new Error('Invalid encrypted secret');const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));decipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8');}
export function encryptSecret(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;}

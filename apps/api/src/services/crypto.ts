import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
const material=process.env.INTEGRATION_ENCRYPTION_KEY??process.env.JWT_SECRET??'development-only-change-this-secret-please';
const key=createHash('sha256').update(material).digest();
export function encryptSecret(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');}
export function decryptSecret(value:string){const [iv,tag,data]=value.split('.');if(!iv||!tag||!data)throw new Error('Invalid encrypted secret');const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8');}

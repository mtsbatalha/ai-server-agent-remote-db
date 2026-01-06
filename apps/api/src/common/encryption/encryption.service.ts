import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EncryptionService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly key: Buffer;

    constructor(private configService: ConfigService) {
        let encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

        if (!encryptionKey || encryptionKey.length < 32) {
            // Auto-generate a secure encryption key
            encryptionKey = crypto.randomBytes(32).toString('hex');
            console.log('\n' + '='.repeat(70));
            console.log('⚠️  ENCRYPTION_KEY was missing or invalid (< 32 chars)');
            console.log('🔐 A new ENCRYPTION_KEY has been auto-generated:');
            console.log('');
            console.log(`   ENCRYPTION_KEY="${encryptionKey}"`);
            console.log('');
            console.log('📋 Please add this to your .env file to persist it!');
            console.log('   Without this, encrypted data will be lost on restart.');
            console.log('='.repeat(70) + '\n');
        }

        this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
    }

    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    decrypt(encryptedText: string): string {
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}

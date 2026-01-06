import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

// Cache for generated secrets (persist during app lifetime)
const generatedSecrets: { [key: string]: string } = {};

/**
 * Gets or generates a secret value.
 * If the secret is missing or too short, generates a new one and logs it.
 */
export function getOrGenerateSecret(
    configService: ConfigService,
    key: string,
    minLength: number = 32,
): string {
    // Check if we already generated this secret in this session
    if (generatedSecrets[key]) {
        return generatedSecrets[key];
    }

    let value = configService.get<string>(key);

    if (!value || value.length < minLength) {
        // Auto-generate a secure secret
        value = crypto.randomBytes(32).toString('hex');
        generatedSecrets[key] = value;

        console.log('\n' + '='.repeat(70));
        console.log(`⚠️  ${key} was missing or invalid (< ${minLength} chars)`);
        console.log(`🔐 A new ${key} has been auto-generated:`);
        console.log('');
        console.log(`   ${key}="${value}"`);
        console.log('');
        console.log('📋 Please add this to your .env file to persist it!');
        console.log('   Without this, authentication tokens will be invalidated on restart.');
        console.log('='.repeat(70) + '\n');
    }

    return value;
}

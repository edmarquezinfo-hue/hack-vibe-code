/**
 * Secure token encryption utilities using AES-GCM
 * Provides secure storage and retrieval of sensitive tokens
 */

/**
 * Encrypts a token using AES-GCM with a random IV
 */
export async function encryptToken(token: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32)); // Ensure 32 bytes for AES-256
    
    // Import the encryption key
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );
    
    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM
    
    // Encrypt the token
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encoder.encode(token)
    );
    
    // Combine IV and encrypted data for storage
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Return as base64 string
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a token that was encrypted with encryptToken
 */
export async function decryptToken(encryptedToken: string, key: string): Promise<string> {
    try {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32)); // Ensure 32 bytes for AES-256
        
        // Import the decryption key
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        
        // Decode from base64
        const combined = new Uint8Array(
            atob(encryptedToken)
                .split('')
                .map(char => char.charCodeAt(0))
        );
        
        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            encrypted
        );
        
        return decoder.decode(decrypted);
    } catch (error) {
        throw new Error('Failed to decrypt token - token may be corrupted or key incorrect');
    }
}

/**
 * Generates a secure random encryption key
 */
export function generateEncryptionKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
}
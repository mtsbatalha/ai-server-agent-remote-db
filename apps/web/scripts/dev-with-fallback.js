/**
 * Development server with port fallback
 * Finds an available port if the default is in use
 */

const net = require('net');
const { spawn } = require('child_process');

const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_ATTEMPTS = 10;

function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port, '0.0.0.0');
    });
}

async function findAvailablePort(startPort) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const port = startPort + attempt;
        if (await isPortAvailable(port)) {
            if (attempt > 0) {
                console.log(`\n⚠️  Port ${startPort} was in use, using port ${port} instead\n`);
            }
            return port;
        }
        console.log(`⚠️  Port ${port} is in use, trying ${port + 1}...`);
    }
    throw new Error(`No available port found after ${MAX_ATTEMPTS} attempts`);
}

async function main() {
    try {
        const port = await findAvailablePort(DEFAULT_PORT);

        console.log(`\n🚀 Starting Next.js on port ${port}...\n`);

        const child = spawn('npx', ['next', 'dev', '-p', port.toString()], {
            stdio: 'inherit',
            shell: true,
            env: { ...process.env, PORT: port.toString() }
        });

        child.on('close', (code) => {
            process.exit(code);
        });

        // Handle termination signals
        process.on('SIGINT', () => child.kill('SIGINT'));
        process.on('SIGTERM', () => child.kill('SIGTERM'));

    } catch (error) {
        console.error('❌', error.message);
        process.exit(1);
    }
}

main();

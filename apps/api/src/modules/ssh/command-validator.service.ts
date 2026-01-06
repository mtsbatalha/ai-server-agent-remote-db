import { Injectable, Logger } from '@nestjs/common';

// Dangerous commands that should NEVER be executed
const BLACKLISTED_PATTERNS = [
    /rm\s+(-[rf]+\s+)*\/(\s|$)/i,           // rm -rf /
    /rm\s+(-[rf]+\s+)*\/\*/i,               // rm -rf /*
    /mkfs/i,                                 // mkfs commands
    /dd\s+if=\/dev\/zero/i,                  // dd if=/dev/zero
    /:\(\)\{\s*:\|:\s*&\s*\}\s*;/,          // Fork bomb
    /chmod\s+(-R\s+)*777\s+\//i,            // chmod 777 /
    />\s*\/dev\/sda/i,                       // > /dev/sda
    /mv\s+\/\*\s+\/dev\/null/i,             // mv /* /dev/null
    /wget.*\|\s*sh/i,                        // wget | sh
    /curl.*\|\s*sh/i,                        // curl | sh
    />\s*\/etc\/passwd/i,                    // > /etc/passwd
    />\s*\/etc\/shadow/i,                    // > /etc/shadow
    /shutdown/i,                             // shutdown
    /reboot\s*$/i,                           // reboot (without conditions)
    /init\s+0/i,                             // init 0
    /halt/i,                                 // halt
    /poweroff/i,                             // poweroff
];

// Commands that require explicit confirmation
const WARNING_PATTERNS = [
    /rm\s+-[rf]/i,                           // rm with force/recursive
    /apt.*remove/i,                          // apt remove
    /apt.*purge/i,                           // apt purge
    /yum.*remove/i,                          // yum remove
    /dnf.*remove/i,                          // dnf remove
    /systemctl\s+stop/i,                     // systemctl stop
    /systemctl\s+disable/i,                  // systemctl disable
    /iptables\s+-F/i,                        // iptables flush
    /ufw\s+disable/i,                        // ufw disable
    /chmod\s+777/i,                          // chmod 777
    /chown.*:.*\//i,                         // chown on root paths
    /DROP\s+DATABASE/i,                      // SQL DROP DATABASE
    /DROP\s+TABLE/i,                         // SQL DROP TABLE
    /TRUNCATE/i,                             // SQL TRUNCATE
];

// Safe commands that don't require confirmation
const SAFE_PATTERNS = [
    /^ls\s/i,
    /^cat\s/i,
    /^head\s/i,
    /^tail\s/i,
    /^grep\s/i,
    /^find\s/i,
    /^echo\s/i,
    /^pwd$/i,
    /^whoami$/i,
    /^hostname$/i,
    /^uname/i,
    /^df\s/i,
    /^du\s/i,
    /^free\s/i,
    /^top\s/i,
    /^ps\s/i,
    /^uptime$/i,
    /^date$/i,
    /^which\s/i,
    /^whereis\s/i,
    /^man\s/i,
    /^systemctl\s+status/i,
    /^service\s+\w+\s+status/i,
    /^ip\s+a/i,
    /^ifconfig$/i,
    /^netstat/i,
    /^ss\s/i,
];

export interface ValidationResult {
    isValid: boolean;
    riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    blockedCommands: string[];
    warningCommands: string[];
    reason?: string;
}

@Injectable()
export class CommandValidatorService {
    private readonly logger = new Logger(CommandValidatorService.name);

    validateCommand(command: string): ValidationResult {
        const trimmedCommand = command.trim();

        // Check blacklist
        for (const pattern of BLACKLISTED_PATTERNS) {
            if (pattern.test(trimmedCommand)) {
                this.logger.warn(`Blocked dangerous command: ${trimmedCommand}`);
                return {
                    isValid: false,
                    riskLevel: 'CRITICAL',
                    blockedCommands: [trimmedCommand],
                    warningCommands: [],
                    reason: 'Command matches dangerous pattern and has been blocked',
                };
            }
        }

        // Check warning patterns
        for (const pattern of WARNING_PATTERNS) {
            if (pattern.test(trimmedCommand)) {
                return {
                    isValid: true,
                    riskLevel: 'HIGH',
                    blockedCommands: [],
                    warningCommands: [trimmedCommand],
                    reason: 'Command requires explicit confirmation before execution',
                };
            }
        }

        // Check safe patterns
        for (const pattern of SAFE_PATTERNS) {
            if (pattern.test(trimmedCommand)) {
                return {
                    isValid: true,
                    riskLevel: 'SAFE',
                    blockedCommands: [],
                    warningCommands: [],
                };
            }
        }

        // Default: medium risk
        return {
            isValid: true,
            riskLevel: 'MEDIUM',
            blockedCommands: [],
            warningCommands: [],
        };
    }

    validateCommands(commands: string[]): ValidationResult {
        const blockedCommands: string[] = [];
        const warningCommands: string[] = [];
        let highestRisk: ValidationResult['riskLevel'] = 'SAFE';

        const riskOrder = ['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

        for (const command of commands) {
            const result = this.validateCommand(command);

            if (!result.isValid) {
                blockedCommands.push(...result.blockedCommands);
            }

            warningCommands.push(...result.warningCommands);

            if (riskOrder.indexOf(result.riskLevel) > riskOrder.indexOf(highestRisk)) {
                highestRisk = result.riskLevel;
            }
        }

        return {
            isValid: blockedCommands.length === 0,
            riskLevel: highestRisk,
            blockedCommands,
            warningCommands,
            reason: blockedCommands.length > 0
                ? 'One or more commands were blocked due to security risks'
                : warningCommands.length > 0
                    ? 'Some commands require confirmation'
                    : undefined,
        };
    }

    sanitizeCommand(command: string): string {
        // Remove potentially dangerous characters
        return command
            .replace(/\$\([^)]*\)/g, '') // Remove $() command substitution
            .replace(/`[^`]*`/g, '')     // Remove backtick command substitution
            .trim();
    }
}

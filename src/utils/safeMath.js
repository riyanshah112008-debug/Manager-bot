'use strict';

const MAX_EXPRESSION_LENGTH = 80;
const MAX_RESULT_MAGNITUDE = 1e9;

/**
 * Evaluate a small arithmetic grammar without compiling or executing JavaScript.
 * Power operators are opt-in so existing counting-game semantics stay unchanged.
 */
function safeEvaluateMath(input, options = {}) {
    const allowPower = options.allowPower === true;
    if (typeof input !== 'string' || input.length === 0 || input.length > MAX_EXPRESSION_LENGTH) return NaN;

    const normalized = input.replace(/\\s+/g, '');
    if (!normalized) return NaN;

    const tokenPattern = allowPower
        ? /(?:\\d+(?:\\.\\d*)?|\\.\\d+)|[()+\\-*/%^]/g
        : /(?:\\d+(?:\\.\\d*)?|\\.\\d+)|[()+\\-*/%]/g;
    const tokens = normalized.match(tokenPattern);
    if (!tokens || tokens.join('') !== normalized) return NaN;

    let index = 0;
    const isBounded = value => Number.isFinite(value) && Math.abs(value) <= MAX_RESULT_MAGNITUDE;

    const parsePrimary = () => {
        const token = tokens[index++];
        if (token === '(') {
            const value = parseExpression();
            if (tokens[index++] !== ')') throw new Error('Unbalanced parentheses');
            return value;
        }
        if (!token || !/^(?:\\d+(?:\\.\\d*)?|\\.\\d+)$/.test(token)) {
            throw new Error('Invalid number');
        }
        return Number(token);
    };

    const parsePower = () => {
        const base = parsePrimary();
        if (allowPower && tokens[index] === '^') {
            index++;
            const exponent = parseUnary();
            return Math.pow(base, exponent);
        }
        return base;
    };

    const parseUnary = () => {
        const token = tokens[index];
        if (token === '+' || token === '-') {
            index++;
            const value = parseUnary();
            return token === '-' ? -value : value;
        }
        return parsePower();
    };

    const parseTerm = () => {
        let value = parseUnary();
        while (['*', '/', '%'].includes(tokens[index])) {
            const operator = tokens[index++];
            const right = parseUnary();
            if ((operator === '/' || operator === '%') && right === 0) {
                throw new Error('Division by zero');
            }
            value = operator === '*' ? value * right
                : operator === '/' ? value / right
                    : value % right;
            if (!isBounded(value)) throw new Error('Result out of range');
        }
        return value;
    };

    const parseExpression = () => {
        let value = parseTerm();
        while (tokens[index] === '+' || tokens[index] === '-') {
            const operator = tokens[index++];
            const right = parseTerm();
            value = operator === '+' ? value + right : value - right;
            if (!isBounded(value)) throw new Error('Result out of range');
        }
        return value;
    };

    try {
        const result = parseExpression();
        if (index !== tokens.length || !isBounded(result)) return NaN;
        return result;
    } catch {
        return NaN;
    }
}

module.exports = safeEvaluateMath;

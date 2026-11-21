// Evaluate basic arithmetic with a bounded parser; never execute message text as JavaScript.
function safeEvaluateMath(input) {
    if (typeof input !== 'string' || input.length > 80) return NaN;
    const tokens = input.match(/\d+(?:\.\d+)?|[()+\-*/%]/g);
    if (!tokens || tokens.join('') !== input.replace(/\s+/g, '')) return NaN;
    let index = 0;
    const parsePrimary = () => {
        const token = tokens[index++];
        if (token === '+' || token === '-') {
            const value = parsePrimary();
            return token === '-' ? -value : value;
        }
        if (token === '(') {
            const value = parseExpression();
            if (tokens[index++] !== ')') throw new Error('Unbalanced parentheses');
            return value;
        }
        if (!token || !/^\d+(?:\.\d+)?$/.test(token)) throw new Error('Invalid number');
        return Number(token);
    };
    const parseTerm = () => {
        let value = parsePrimary();
        while (['*', '/', '%'].includes(tokens[index])) {
            const op = tokens[index++];
            const rhs = parsePrimary();
            if ((op === '/' || op === '%') && rhs === 0) throw new Error('Division by zero');
            value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs;
        }
        return value;
    };
    const parseExpression = () => {
        let value = parseTerm();
        while (tokens[index] === '+' || tokens[index] === '-') {
            const op = tokens[index++];
            const rhs = parseTerm();
            value = op === '+' ? value + rhs : value - rhs;
        }
        return value;
    };
    try {
        const result = parseExpression();
        if (index !== tokens.length || !Number.isFinite(result) || Math.abs(result) > 1e9) return NaN;
        return result;
    } catch {
        return NaN;
    }
}

module.exports = { safeEvaluateMath };

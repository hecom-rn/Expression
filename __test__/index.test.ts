import Expression from '../src/index';

function expression(content: string, data?: any, fieldNames?: any) {
    return Expression.calculate('${' + content + '}', fieldNames, data);
}

/**
 * 函数相关的表达式测试用例
 */
describe('formula', () => {
    const user = {code: '123', name: 'test', dept: {code: '2', name: 'testDept'}};
    const callbackFuncMap = {
        currentUser: () => user
    };
    Expression.setConfig(callbackFuncMap);
    test('ABS', () => {
        const f = function (count) {
            const result = expression(`ABS(${count})`);
            expect(result).toBe(Math.abs(count))
        };
        f(5);
        f(-5);
    });
    test('CEILINT', () => {
        const count = 1.5;
        const result = expression(`CEILING(${count})`);
        expect(result).toBe(Math.ceil(count))
    });
    test('FLOOR', () => {
        const count = 5.5;
        const result = expression(`FLOOR(${count})`);
        expect(result).toBe(Math.floor(count))
    });
    test('LN', () => {
        const count = 5.5;
        const result = expression(`LN(${count})`);
        expect(result).toBe(Math.log(count));
    });
    test('LOG', () => {
        const count = 5.5;
        const result = expression(`LOG(${count})`);
        expect(result).toBe(Math.log10(count));
    });
    test('MOD', () => {
        const count = 5.5;
        const divisor = 2;
        const result = expression(`MOD(${count}, ${divisor})`);
        expect(result).toBe(count % divisor);
    });
    test('ROUND', () => {
        const count = 5.538;
        const divisor = 2;
        const result = expression(`ROUND(${count}, ${divisor})`);
        expect(result).toBe(5.54);
    });
    test('SQRT', () => {
        const count = 5.538;
        const result = expression(`SQRT(${count})`);
        expect(result).toBe(Math.sqrt(count));
    });
    test('AND', () => {
        const result = expression(`AND(1, true, 0)`);
        expect(result).toBeFalsy()
    });
    test('OR', () => {
        const result = expression(`OR(true,FALSE())`);
        expect(result).toBeTruthy();
    });

    test('TIMEDIF', () => {
        const dif = 4832894;
        const start = Date.now();
        let end = start + dif;
        const units = ['h', 'm', 's'];
        units.forEach(unit => {
            const result = expression(`TIMEDIF(${start}, ${end}, "${unit}")`);
            const div = unit === 'h' ? 1000 * 3600 : unit === 'm' ? 1000 * 60 : 1000;
            expect(result).toBe(Math.floor(dif / div))
        });
        end = start - dif;
        units.forEach(unit => {
            const result = expression(`TIMEDIF(${start}, ${end}, "${unit}")`);
            const div = unit === 'h' ? 1000 * 3600 : unit === 'm' ? 1000 * 60 : 1000;
            expect(result).toBe(Math.ceil(-dif / div))
        })
    });

    test('CURRENT_USER', () => {
        const result = expression(`CURRENT_USER()`);
        expect(result.code).toBe(user.code);
        expect(result.name).toBe(user.name);
    });

    test('TO_CAPITAL_RMB', () => {
        const moneyArr = [
            {key: 0.0, value: '零元整'},
            {key: 123456789000.123, value: '壹仟贰佰叁拾肆亿伍仟陆佰柒拾捌万玖仟元壹角贰分'},
            {key: 88776699.55, value: '捌仟捌佰柒拾柒万陆仟陆佰玖拾玖元伍角伍分'},
        ];
        moneyArr.forEach(item => {
            const result = expression(`TO_CAPITAL_RMB(${item.key})`);
            expect(result).toBe(item.value);
        });
    })
});
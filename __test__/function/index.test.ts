import Expression, {_dateFromAny} from '../../src/index';
import testCaseList from './函数公式.json';
import {advanceTo, clear} from 'jest-date-mock';
import {setSystemTimezone, setDefaultTimezone, TimeUtils} from '@hecom/aDate';

const funcMap = Object.keys(Expression.funcMap).reduce((pre, cur) => {
    pre[cur] = (...args) => {
        return Expression.funcMap[cur](...args);
    }
    return pre;
}, {} as typeof Expression.funcMap);
const allTestCase = testCaseList.map(testCase => Object.assign(testCase, {toString: () => testCase.code.substring(-3)}))
describe('时间函数测试', () => {
    beforeAll(() => {
        setSystemTimezone('Asia/Tokyo');
        setDefaultTimezone('Asia/Shanghai');
    });
    it.each(allTestCase.filter(item => item.code.startsWith('DATEDIF')))('DATEDIF-%s', ({
                                                                                            ['返回值']: result,
                                                                                            ['参数1']: start,
                                                                                            ['参数2']: end,
                                                                                            ['参数3']: type,
                                                                                        }) => {
        expect(funcMap.DATEDIFV2(start, end, type)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('TIMEDIF')))('TIMEDIF-%s', ({
                                                                                          ['返回值']: result,
                                                                                          ['参数1']: start,
                                                                                          ['参数2']: end,
                                                                                          ['参数3']: type,
                                                                                      }) => {
        expect(funcMap.TIMEDIF(start, end, type)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('TODAY')))('TODAY', () => {
        const today = TimeUtils.create().startOfDay();
        expect(funcMap.TODAY()).toEqual(today.valueOf())
    })
    it.each(allTestCase.filter(item => item.code.includes('NOW')))('NOW', () => {
        const now = TimeUtils.create().millisecond(0);
        expect(funcMap.NOW()).toEqual(now.valueOf())
    })
    it.each(allTestCase.filter(item => item.code.includes('DATEOFFSET')))('DATEOFFSET-%s', ({
                                                                                                ['返回值']: result,
                                                                                                ['参数1']: start,
                                                                                                ['参数2']: unit,
                                                                                                ['参数3']: value,
                                                                                            }: any) => {
        const date = funcMap.DATEOFFSET(start, unit, value == null || isNaN(value) ? value : Number(value))
        expect(date).toEqual(result === null ? result : _dateFromAny(result)?.valueOf())
    })
    it.each(allTestCase.filter(item => item.code.includes('TIMEOFFSET')))('TIMEOFFSET-%s', ({
                                                                                                ['返回值']: result,
                                                                                                ['参数1']: start,
                                                                                                ['参数2']: unit,
                                                                                                ['参数3']: value,
                                                                                            }: any) => {
        const date = funcMap.TIMEOFFSET(start, unit, value == null || isNaN(value) ? value : Number(value))
        expect(date).toEqual(result === null ? result : _dateFromAny(result)?.valueOf())
    })
    it.each(allTestCase.filter(item => item.code.startsWith('DAY')))('DAY-%s', ({
                                                                                  ['返回值']: result,
                                                                                  ['参数1']: date,
                                                                              }) => {
        expect(funcMap.DAY(date)).toEqual(result == null ? result : Number(result));
    })
    it.each(allTestCase.filter(item => item.code.includes('MONTH')))('MONTH-%s', ({
                                                                                      ['返回值']: result,
                                                                                      ['参数1']: date,
                                                                                  }) => {
        expect(funcMap.MONTH(date)).toEqual(result == null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('YEAR')))('YEAR-%s', ({
                                                                                    ['返回值']: result,
                                                                                    ['参数1']: date,
                                                                                }: any) => {
        expect(funcMap.YEAR(date)).toEqual(result == null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('TODATE')))('TODATE-%s', ({
                                                                                        ['返回值']: result,
                                                                                        ['参数1']: year,
                                                                                        ['参数2']: month,
                                                                                        ['参数3']: day,
                                                                                    }: any) => {
        const date = funcMap.TODATE(year, month, day);
        expect(date).toEqual(
            result === null || result == '' || result == undefined ? result : _dateFromAny(result).valueOf(true))
    })
    it.each(allTestCase.filter(item => item.code.includes('DATEVALUE')))('DATEVALUE-%s', ({
                                                                                              ['返回值']: result,
                                                                                              ['参数1']: date,
                                                                                          }: any) => {
        expect(funcMap.DATEVALUE(date)).toEqual(result);
    })
    it.each(allTestCase.filter(item => item.code.includes('WEEKDAY')))('WEEKDAY-%s', ({
                                                                                          ['返回值']: result,
                                                                                          ['参数1']: value,
                                                                                          ['参数2']: type,
                                                                                      }: any) => {
        const date = _dateFromAny(value);
        expect(funcMap.WEEKDAY((date == null ? value : date.valueOf()) as number,
            (type == null || type == undefined || isNaN(Number(type)) ? type : Number(type)) as 1 | 2 | 3))
            .toEqual(result === null ? null : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('TOTIMESTAMP')))('TOTIMESTAMP-%s', ({
                                                                                          ['返回值']: result,
                                                                                          ['参数1']: dateTime,
                                                                                      }) => {
        expect(funcMap.TOTIMESTAMP(dateTime as number)).toEqual(result)
    })
})

describe('数学函数测试', () => {
    it.each(allTestCase.filter(item => item.code.includes('ABS')))('ABS-%s', ({
                                                                                  ['返回值']: result,
                                                                                  ['参数1']: value,
                                                                              }) => {
        expect(funcMap.ABS(value)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('CEILING')))('CEILING-%s', ({
                                                                                          ['返回值']: result,
                                                                                          ['参数1']: value,
                                                                                      }) => {
        expect(funcMap.CEILING(value)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('FLOOR')))('FLOOR-%s', ({
                                                                                      ['返回值']: result,
                                                                                      ['参数1']: value,
                                                                                  }) => {
        expect(funcMap.FLOOR(value)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('LN')))('LN-%s', ({
                                                                                ['返回值']: result,
                                                                                ['参数1']: value,
                                                                            }) => {
        expect(funcMap.LN(value)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('LOG')))('LOG-%s', ({
                                                                                  ['返回值']: result,
                                                                                  ['参数1']: value,
                                                                              }) => {
        expect(funcMap.LOG(value)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('MOD')))('MOD-%s', ({
                                                                                  ['返回值']: result,
                                                                                  ['参数1']: value,
                                                                                  ['参数2']: divisor,
                                                                              }) => {
        expect(funcMap.MOD(value, divisor)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('ROUND')))('ROUND-%s', ({
                                                                                      ['返回值']: result,
                                                                                      ['参数1']: value,
                                                                                      ['参数2']: digits,
                                                                                  }) => {
        expect(funcMap.ROUND(value, digits)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('SQRT')))('SQRT-%s', ({
                                                                                    ['返回值']: result,
                                                                                    ['参数1']: value,
                                                                                }) => {
        expect(funcMap.SQRT(value)).toEqual(result === null ? result : Number(result))
    })
    // it.each(allTestCase.filter(item => item.code.includes('THOUSANDSEP')))('THOUSANDSEP-%s', ({
    //                                                                                               ['返回值']: result,
    //                                                                                               ['参数1']: value,
    //                                                                                           }) => {
    //     expect(funcMap.THOUSANDSEP(value)).toEqual(result)
    // })
    it.each(allTestCase.filter(item => item.code.includes('MAX')))('MAX-%s', ({
                                                                                  ['返回值']: result,
                                                                                  ['参数1']: arg1,
                                                                                  ['参数2']: arg2,
                                                                                  ['参数3']: arg3,
                                                                                  ['参数4']: arg4,
                                                                                  ['参数5']: arg5,
                                                                              }) => {
        const args = [arg1, arg2, arg3, arg4, arg5].filter(i => i !== undefined)
        expect(funcMap.MAX(...args)).toEqual(result === null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('MIN')))('MIN-%s', ({
                                                                                  ['返回值']: result,
                                                                                  ['参数1']: arg1,
                                                                                  ['参数2']: arg2,
                                                                                  ['参数3']: arg3,
                                                                                  ['参数4']: arg4,
                                                                                  ['参数5']: arg5,
                                                                              }) => {
        const args = [arg1, arg2, arg3, arg4, arg5].filter(i => i !== undefined)
        expect(funcMap.MIN(...args)).toEqual(result === null ? result : Number(result))
    })
})

describe('文本函数测试', () => {
    it.each(allTestCase.filter(item => item.code.includes('LEFT')))('LEFT-%s', ({
                                                                                    ['返回值']: result,
                                                                                    ['参数1']: text,
                                                                                    ['参数2']: numChars,
                                                                                }) => {
        expect(funcMap.LEFT(text,
            numChars == null || isNaN(Number(numChars)) ? numChars : Number(numChars)))
            .toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('RIGHT')))('RIGHT-%s', ({
                                                                                      ['返回值']: result,
                                                                                      ['参数1']: text,
                                                                                      ['参数2']: numChars,
                                                                                  }) => {
        expect(funcMap.RIGHT(text,
            numChars == null || isNaN(Number(numChars)) ? numChars : Number(numChars)))
            .toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('SEARCH')))('SEARCH-%s', ({
                                                                                        ['返回值']: result,
                                                                                        ['参数1']: value,
                                                                                        ['参数2']: keyword,
                                                                                    }) => {
        expect(funcMap.SEARCH(value, keyword)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('CONCATENATE')))('CONCATENATE-%s', ({
                                                                                                  ['返回值']: result,
                                                                                                  ['参数1']: arg1,
                                                                                                  ['参数2']: arg2,
                                                                                                  ['参数3']: arg3,
                                                                                                  ['参数4']: arg4,
                                                                                                  ['参数5']: arg5,
                                                                                              }) => {
        const args = [arg1, arg2, arg3, arg4, arg5].filter(i => i !== undefined);
        expect(funcMap.CONCATENATE(...args)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('TEXT')))('TEXT-%s', ({
                                                                                    ['返回值']: result,
                                                                                    ['参数1']: value,
                                                                                }) => {
        expect(funcMap.TEXT(value)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('TOCAPITAL')))('TOCAPITAL-%s', ({
                                                                                              ['返回值']: result,
                                                                                              ['参数1']: value,
                                                                                          }) => {
        expect(funcMap.TOCAPITAL(value == null || isNaN(Number(value)) ? value : Number(value))).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('TO_CAPITAL_RMB')))('TO_CAPITAL_RMB-%s', ({
                                                                                                        ['返回值']: result,
                                                                                                        ['参数1']: value,
                                                                                                    }) => {
        expect(funcMap.TO_CAPITAL_RMB(value)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('FIND')))('FIND-%s', ({
                                                                                    ['返回值']: result,
                                                                                    ['参数1']: target,
                                                                                    ['参数2']: text,
                                                                                    ['参数3']: start,
                                                                                }: any) => {
        expect(funcMap.FIND(target, text, start == null || isNaN(Number(start)) ? start : Number(start)))
            .toEqual(result == null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('SLICE')))('SLICE-%s', ({
                                                                                      ['返回值']: result,
                                                                                      ['参数1']: text,
                                                                                      ['参数2']: start,
                                                                                      ['参数3']: length,
                                                                                  }: any) => {
        expect(funcMap.SLICE(text, (start == null || isNaN(Number(start)) ? start : Number(start)) as number,
            (length == null || isNaN(Number(length)) ? length : Number(length)) as number)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('ID_TO_AGE')))('ID_TO_AGE-%s', ({
                                                                                              ['返回值']: result,
                                                                                              ['参数1']: idNumber,
                                                                                          }: any) => {
        advanceTo('2023-01-01')
        expect(funcMap.ID_TO_AGE(idNumber)).toEqual(result == null ? result : Number(result))
    })
    it.each(allTestCase.filter(item => item.code.includes('TONUMBER')))('TONUMBER-%s', ({
                                                                                            ['返回值']: result,
                                                                                            ['参数1']: start,
                                                                                        }: any) => {
        expect(funcMap.TONUMBER(start)).toEqual(result == null ? result : Number(result))
    })
})

describe('逻辑函数测试', () => {
    it.each(allTestCase.filter(item => item.code.startsWith('AND')))('AND-%s', ({
                                                                                    ['返回值']: result,
                                                                                    ['参数1']: arg1,
                                                                                    ['参数2']: arg2,
                                                                                    ['参数3']: arg3,
                                                                                    ['参数4']: arg4,
                                                                                    ['参数5']: arg5,
                                                                                }) => {
        const args = [arg1, arg2, arg3, arg4, arg5].filter(i => i !== undefined);
        expect(funcMap.AND(...args)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.startsWith('OR')))('OR-%s', ({
                                                                                  ['返回值']: result,
                                                                                  ['参数1']: arg1,
                                                                                  ['参数2']: arg2,
                                                                                  ['参数3']: arg3,
                                                                                  ['参数4']: arg4,
                                                                                  ['参数5']: arg5,
                                                                              }) => {
        const args = [arg1, arg2, arg3, arg4, arg5].filter(i => i !== undefined);
        expect(funcMap.OR(...args)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.startsWith('IF')))('IF-%s', ({
                                                                                  ['返回值']: result,
                                                                                  ['参数1']: logical,
                                                                                  ['参数2']: trueValue,
                                                                                  ['参数3']: falseValue,
                                                                              }) => {
        expect(funcMap.IF(logical, trueValue, falseValue)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('FirstNotNull')))('FirstNotNull-%s', ({
                                                                                                    ['返回值']: result,
                                                                                                    ['参数1']: arg1,
                                                                                                    ['参数2']: arg2,
                                                                                                    ['参数3']: arg3,
                                                                                                    ['参数4']: arg4,
                                                                                                    ['参数5']: arg5,
                                                                                                }) => {
        const args = [arg1, arg2, arg3, arg4, arg5].filter(i => i !== undefined);
        expect(funcMap.FirstNotNull(...args)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('TRUE')))('TRUE-%s', ({
                                                                                    ['返回值']: result,
                                                                                }) => {
        expect(funcMap.TRUE()).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('FALSE')))('FALSE-%s', ({
                                                                                      ['返回值']: result,
                                                                                  }) => {
        expect(funcMap.FALSE()).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('isNotNULL')))('isNotNULL-%s', ({
                                                                                              ['返回值']: result,
                                                                                              ['参数1']: value,
                                                                                          }) => {
        expect(funcMap.isNotNULL(value)).toEqual(result)
    })
    it.each(allTestCase.filter(item => item.code.includes('isNULL')))('isNULL-%s', ({
                                                                                        ['返回值']: result,
                                                                                        ['参数1']: value,
                                                                                    }) => {
        expect(funcMap.isNULL(value)).toEqual(result)
    })
})

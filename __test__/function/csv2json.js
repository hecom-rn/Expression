const csvFilePath = './__test__/function/函数公式.csv'
const jsonFilePath = './__test__/function/函数公式.json'
const csv = require('csvtojson');
const fs = require('fs')
const {TimeUtils} = require('@hecom/aDate');

const all = []
const convert = (value) => {
    if (value === '空') {
        return null;
    } else if (value === '') {
        return undefined;
    } else if (value === 'FALSE' || value === 'false') {
        return false;
    } else if (value === 'TRUE' || value === 'true') {
        return true;
    } else if (value.startsWith('日期：') || value.startsWith('时间：')) {
        return TimeUtils.create(value.replace('日期：', '').replace('时间：', '')).getTime();
    } else if (value.startsWith('文本：')) {
        return value.replace('文本：', '')
    } else if (value.startsWith('数值：')) {
        return Number(value.replace('数值：', ''))
    } else {
        return value;
    }
};
const keys = ['返回值', '参数1', '参数2', '参数3', '参数4', '参数5'];
csv({trim: false})
    .fromFile(csvFilePath)
    .then((data) => {
        data.forEach(json => {
            if (json['编号'] && json['不适用（0：不适用前端，1：不适用后端）'] !== '0') {
                all.push(Object.keys(json).reduce((pre, cur) => {
                    if (cur === '编号') {
                        pre.code = json[cur]
                    } else if (keys.includes(cur)) {
                        pre[cur] = convert(json[cur])
                    }
                    return pre;
                }, {}));
            }
        })
        fs.writeFileSync(jsonFilePath, JSON.stringify(all, null, 4))
    })

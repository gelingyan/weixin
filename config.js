/**
 * Created by gly on 2017/7/4.
 */
'use strict'

var path = require('path')
var util = require('./libs/util')
var wechat_file = path.join(__dirname, './config/wechat.txt')

var config = {
    wechat: {
        appID: 'wxd78cf91d2154ce37',
        appSecret: '4137a6e683761389099eeefe366f20dd',
        token: 'gelingyan',
        getAccessToken: function () {
            return util.readFileAsync(wechat_file)
        },
        saveAccessToken: function (data) {
            data = JSON.stringify(data)
            return util.writeFileAsync(wechat_file, data)
        }
    }
}

module.exports = config
/**
 * Created by gly on 2017/7/4.
 */
'use strict'
var Promise = require('bluebird')
var request = Promise.promisify(require('request'))
var prefix = 'https://api.weixin.qq.com/cgi-bin/'
var api = {
    accessToken: prefix + 'token?grant_type=client_credential'
}

function Wechat(opts) {
    var that = this
    this.appID = opts.appID
    this.appSecret = opts.appSecret
    this.getAccessToken = opts.getAccessToken
    this.saveAccessToken = opts.saveAccessToken

    this.getAccessToken()
       .then(function (data) {
            try { // 票据是否过期
                data = JSON.parse(data)
            }
            catch(e) {
                return that.updateAccessToken() // 更新票据
            }

            if (that.isValidAccessToken(data)) { // 票据是否合法
                Promise.resolve(data)
            } else {
                return that.updateAccessToken() // 更新票据
            }
        })
        .then(function (data) { //票据结果
            that.access_token = data.access_token // access_token 挂到实例上
            that.expires_in = data.expires_in // expires_in 过期字段

            that.saveAccessToken(data) // 调用save方法存储
        })
}

Wechat.prototype.isValidAccessToken = function (data) {
    if(!data || !data.access_token || !data.expires_in) {
        return false
    }
    var access_token = data.access_token
    var expires_in = data.expires_in
    var now = (new Date().getTime())

    if (now < expires_in) {
        return true
    } else {
        return false
    }
}

Wechat.prototype.updateAccessToken = function () {
    var appID = this.appID
    var appSecret = this.appSecret
    var url = api.accessToken + '&appid=' + appID + '&secret=' + appSecret

    return new Promise(function (resolve, reject) {
        request({url: url, json: true}).then(function (response) {
            //    console.log(response.body)
            var data = response.body
            var now = (new Date().getTime())
            var expires_in = now + (data.expires_in - 20) * 1000 // 票据提前20s刷新

            data.expires_in = expires_in // 新的票据的有效时间赋值给data对象
            resolve(data)
        })
    })
}

module.exports = Wechat
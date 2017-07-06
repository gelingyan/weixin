/**
 * Created by gly on 2017/7/4.
 */
'use strict'
var Promise = require('bluebird')
var _ = require('lodash')
var request = Promise.promisify(require('request'))
var util = require('./util')
var fs = require('fs')
var prefix = 'https://api.weixin.qq.com/cgi-bin/'
var api = {
    accessToken: prefix + 'token?grant_type=client_credential',
    temporary: {// 临时素材
        upload: prefix + 'media/upload?',
        fetch: prefix + 'media/get?', // 获取临时素材
    },
    permanent: {//永久素材
        upload: prefix + 'material/add_material?',
        uploadNews: prefix + 'material/add_news?', // 图文
        uploadNewsPic: prefix + 'media/uploadimg?', // 图文消息的图片
        fetch: prefix + 'material/get_material?', // 获取永久素材
        del: prefix + 'material/del_material?', // 删除永久素材
        update: prefix + 'material/update_news?' // 更新永久图文素材
    }
}

function Wechat(opts) {
    var that = this
    this.appID = opts.appID
    this.appSecret = opts.appSecret
    this.getAccessToken = opts.getAccessToken
    this.saveAccessToken = opts.saveAccessToken

    this.fetchAccessToken()
}

Wechat.prototype.fetchAccessToken = function (data) {
    var that = this
    if (this.access_token && this.expires_in) {
        if (this.isValidAccessToken(this)) {
            return Promise.resolve(this)
        }
    }

    this.getAccessToken()
        .then(function (data) {
            try { // 票据是否过期
                data = JSON.parse(data)
            }
            catch(e) {
                return that.updateAccessToken() // 更新票据
            }

            if (that.isValidAccessToken(data)) { // 票据是否合法
                return  Promise.resolve(data)
            } else {
                return that.updateAccessToken() // 更新票据
            }
        })
        .then(function (data) { //票据结果
            that.access_token = data.access_token // access_token 挂到实例上
            that.expires_in = data.expires_in // expires_in 过期字段

            that.saveAccessToken(data) // 调用save方法存储

            return Promise.resolve(data)
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
            var data = response.body
            var now = (new Date().getTime())
            var expires_in = now + (data.expires_in - 20) * 1000 // 票据提前20s刷新

            data.expires_in = expires_in // 新的票据的有效时间赋值给data对象
            resolve(data)
        })
    })
}

// 上传素材
Wechat.prototype.uploadMaterial = function (type, material, permanent) { //material素材， permanent是否为永久素材
    var that = this
    var form = {}
    var uploadUrl = api.temporary.upload

    if (permanent) { // 永久素材
        uploadUrl = api.permanent.upload

        _.extend(form, permanent) // form兼容所有上传类型，包括图文消息，所以去继承permanent对象
    }

    if (type === 'pic') { // 图文消息的图片
        uploadUrl = api.permanent.uploadNewsPic
    }

    if (type === 'news') {
        uploadUrl = api.permanent.uploadNews
        form = material // 图文时，material是图文数据
    } else {
        form.media = fs.createReadStream(material) // material是字符串的文件路径
    }

    return new Promise(function (resolve, reject) {
        that
            .fetchAccessToken()
            .then(function (data) {
                var url = uploadUrl + 'access_token=' + data.access_token

                if (!permanent) {
                    url += '&type=' + type
                } else {
                    form.access_token = data.access_token
                }

                var options = {
                    method: 'POST',
                    url: url,
                    json: true
                }

                if (type === 'news') {
                    options.body = form
                } else {
                    options.formData = form
                }

                request(options).then(function (response) {
                    var _data = response.body

                    if (_data) {
                        resolve(_data)
                    } else {
                        throw new Error('Upload material fails')
                    }
                })
                .catch(function (err) {
                    reject(err)
                })
            })
    })
}

// 获取素材
Wechat.prototype.fetchMaterial = function (mediaId, type, permanent) { //material素材， permanent是否为永久素材
    var that = this
    var fetchUrl = api.temporary.fetch

    if (permanent) { // 永久素材
        fetchUrl = api.permanent.fetch
    }

    return new Promise(function (resolve, reject) {
        that
            .fetchAccessToken()
            .then(function (data) {
                var url = fetchUrl + 'access_token=' + data.access_token + '&media_id=' + mediaId

                if (!permanent && type === 'video') {
                    url = replace('https://', 'http://')
                    url += '&type=' + type
                }

                resolve(url)
            })
    })
}

// 删除永久素材
Wechat.prototype.deleteMaterial = function (mediaId) {
    var that = this
    var form = {
        media_id: mediaId
    }

    return new Promise(function (resolve, reject) {
        that
            .fetchAccessToken()
            .then(function (data) {
                var url = api.temporary.del + 'access_token=' + data.access_token + '&media_id=' + mediaId

                var options = {
                    method: 'POST',
                    url: url,
                    body: form,
                    json: true
                }

                request(options).then(function (response) {
                    var _data = response.body

                    if (_data) {
                        resolve(_data)
                    } else {
                        throw new Error('Delete material fails')
                    }
                })
                .catch(function (err) {
                    reject(err)
                })
            })
    })
}

/* 更新永久图文素材*/
Wechat.prototype.uplodateMaterial = function (mediaId, mews) {
    var that = this
    var form = {
        media_id: mediaId
    }
    _.extend(form, mews)

    return new Promise(function (resolve, reject) {
        that
            .fetchAccessToken()
            .then(function (data) {
                var url = api.temporary.update + 'access_token=' + data.access_token + '&media_id=' + mediaId

                var options = {
                    method: 'POST',
                    url: url,
                    body: form,
                    json: true
                }

                request(options).then(function (response) {
                    var _data = response.body

                    if (_data) {
                        resolve(_data)
                    } else {
                        throw new Error('Upload material fails')
                    }
                })
                .catch(function (err) {
                    reject(err)
                })
            })
    })
}

Wechat.prototype.reply = function () {
    var content = this.body
    var message = this.weixin
    var xml = util.tpl(content, message)

    this.status = 200
    this.type = 'application/xml'
    this.body = xml
}
module.exports = Wechat
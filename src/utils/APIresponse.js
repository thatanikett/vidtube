class APIresponse {
    constructor(statusCode, data, message = "sucess"){
        this.statusCode = statusCode
        this.data = data
        this.message = message
        this.success = statusCode < 400
    }
}

export { APIresponse }
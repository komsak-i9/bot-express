'use strict';

let Line = require("./service/line");
let Facebook = require("./service/facebook");

module.exports = class VirtualPlatform {
    constructor(options){
        this.type = options.message_platform_type;
        this.options = options;
        this.service = this.instantiate_service();
    }

    instantiate_service(){
        return this[`_${this.type}_instantiate_service`]();
    }

    _line_instantiate_service(){
        return new Line(this.options.line_channel_id, this.options.line_channel_secret, this.options.line_channel_access_token);
    }

    _facebook_instantiate_service(){
        return new Facebook(this.options.facebook_page_access_token);
    }

    validate_signature(req){
        return this[`_${this.type}_validate_signature`](req);
    }

    _line_validate_signature(req){
        if (!this.service.validate_signature(req.get('X-Line-Signature'), req.raw_body)){
            throw(`Signature Validation failed.`);
        }
    }

    // Under development
    _facebook_validate_signature(req){
        return true;
    }

    extract_events(body){
        return this[`_${this.type}_extract_events`](body);
    }

    _line_extract_events(body){
        return body.events;
    }

    _facebook_extract_events(body){
        let events = [];
        for (let entry of body.entry){
            events = events.concat(entry.messaging);
        }
        return events;
    }

    extract_memory_id(bot_event){
        return this[`_${this.type}_extract_memory_id`](bot_event);
    }

    _line_extract_memory_id(bot_event){
        return "line_" + bot_event.source.userId;
    }

    _facebook_extract_memory_id(bot_event){
        return "facebook_" + bot_event.sender.id;
    }

    check_supported_event_type(flow, bot_event){
        return this[`_${this.type}_check_supported_event_type`](flow, bot_event);
    }

    _line_check_supported_event_type(flow, bot_event){
        switch(flow){
            case "start_conversation":
                if (bot_event.type == "message" && bot_event.message.type == "text"){
                    return true;
                }
                return false;
            break;
            case "reply":
                if ((bot_event.type == "message" && bot_event.message.type == "text") || bot_event.type == "postback"){
                    return true;
                }
                return false;
            break;
            case "change_intent":
                if (bot_event.type == "message" && bot_event.message.type == "text"){
                    return true;
                }
                return false;
            break;
            case "change_parameter":
                if ((bot_event.type == "message" && bot_event.message.type == "text") || bot_event.type == "postback"){
                    return true;
                }
                return false;
            break;
            case "no_way":
                if (bot_event.type == "message" && bot_event.message.type == "text"){
                    return true;
                }
                return false;
            break;
            default:
                return false;
            break;
        }
    }

    _facebook_check_supported_event_type(flow, bot_event){
        switch(flow){
            case "start_conversation":
                if (bot_event.message && bot_event.message.text){
                    return true;
                }
                return true;
            break;
            case "reply":
                if ((bot_event.message && bot_event.message.text) || bot_event.postback){
                    return true;
                }
                return true;
            break;
            case "change_intent":
                if (bot_event.message && bot_event.message.text){
                    return true;
                }
                return true;
            break;
            case "change_parameter":
                if ((bot_event.message && bot_event.message.text) || bot_event.postback){
                    return true;
                }
                return true;
            break;
            case "no_way":
                if (bot_event.message && bot_event.message.text){
                    return true;
                }
                return true;
            break;
            default:
                return false;
            break;
        }
    }

    extract_session_id(bot_event){
        return this[`_${this.type}_extract_session_id`](bot_event);
    }

    _line_extract_session_id(bot_event){
        return bot_event.source.userId;
    }

    _facebook_extract_session_id(bot_event){
        return bot_event.sender.id;
    }

    extract_message_text(bot_event){
        return this[`_${this.type}_extract_message_text`](bot_event);
    }

    _line_extract_message_text(bot_event){
        let message_text;
        switch(bot_event.type){
            case "message":
                message_text = bot_event.message.text;
            break;
            case "postback":
                message_text = bot_event.postback.data;
            break;
        }
        return message_text;
    }

    _facebook_extract_message_text(bot_event){
        let message_text;
        if (bot_event.message && bot_event.message.text){
            message_text = bot_event.message.text;
        } else if (bot_event.postback){
            message_text = bot_event.postback.payload;
        }
        return message_text;
    }

    create_message(message_object, message_type){
        return this[`_${this.type}_create_message`](message_object, message_type);
    }

    _line_create_message(message_object, message_type = "text"){
        let message;
        switch(message_type){
            case "text":
                message = {
                    type: "text",
                    text: message_object
                }
            break;
        }
        return message;
    }

    _facebook_create_message(message_object, message_type = "text"){
        let message;
        switch(message_type){
            case "text":
                message = {
                    text: message_object
                }
            break;
        }
        return message;
    }

    reply(bot_event, messages){
        return this[`_${this.type}_reply`](bot_event, messages);
    }

    _line_reply(bot_event, messages){
        return this.service.reply(bot_event.replyToken, messages);
    }

    _facebook_reply(bot_event, messages){
        return this.service.send({id: bot_event.sender.id}, messages);
    }
}
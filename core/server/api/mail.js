// # Mail API
// API for sending Mail

var Promise = require('bluebird'),
    pipeline = require('../lib/promise/pipeline'),
    localUtils = require('./utils'),
    models = require('../models'),
    common = require('../lib/common'),
    mail = require('../services/mail'),
    notificationsAPI = require('./notifications'),
    docName = 'mail',
    mailer,
    apiMail;

/**
 * Send mail helper
 */
function sendMail(object) {
    if (!(mailer instanceof mail.GhostMailer)) {
        mailer = new mail.GhostMailer();
    }

    return mailer.send(object.mail[0].message).catch(function (err) {
        if (mailer.state.usingDirect) {
            notificationsAPI.add(
                {
                    notifications: [{
                        type: 'warn',
                        message: [
                            common.i18n.t('warnings.index.unableToSendEmail'),
                            common.i18n.t('common.seeLinkForInstructions', {link: 'https://docs.ghost.org/docs/mail-config'})
                        ].join(' ')
                    }]
                },
                {context: {internal: true}}
            );
        }

        return Promise.reject(err);
    });
}

/**
 * ## Mail API Methods
 *
 * **See:** [API Methods](constants.js.html#api%20methods)
 * @typedef Mail
 * @param mail
 */
apiMail = {
    /**
     * ### Send
     * Send an email
     *
     * @public
     * @param {Mail} object details of the email to send
     * @returns {Promise}
     */
    send: function (object, options) {
        var tasks;

        /**
         * ### Format Response
         * @returns {Mail} mail
         */

        function formatResponse(data) {
            delete object.mail[0].options;
            // Sendmail returns extra details we don't need and that don't convert to JSON
            delete object.mail[0].message.transport;
            object.mail[0].status = {
                message: data.message
            };

            return object;
        }

        /**
         * ### Send Mail
         */

        function send() {
            return sendMail(object, options);
        }

        tasks = [
            localUtils.handlePermissions(docName, 'send'),
            send,
            formatResponse
        ];

        return pipeline(tasks, options || {});
    },

    /**
     * ### SendTest
     * Send a test email
     *
     * @public
     * @param {Object} options required property 'to' which contains the recipient address
     * @returns {Promise}
     */
    sendTest: function (options) {
        var tasks;

        /**
         * ### Model Query
         */

        function modelQuery() {
            return models.User.findOne({id: options.context.user});
        }

        /**
         * ### Generate content
         */

        function generateContent(result) {
            return mail.utils.generateContent({template: 'test'}).then(function (content) {
                var payload = {
                    mail: [{
                        message: {
                            to: result.get('email'),
                            subject: common.i18n.t('common.api.mail.testGhostEmail'),
                            html: content.html,
                            text: content.text
                        }
                    }]
                };

                return payload;
            });
        }

        /**
         * ### Send mail
         */

        function send(payload) {
            return sendMail(payload, options);
        }

        tasks = [
            modelQuery,
            generateContent,
            send
        ];

        return pipeline(tasks);
    },

    sendContact: function (object, options) {
        var tasks, emailData, adminEmail;
    
        window.alert("here I am");
        
        function generateEmails(options) {
    
            // Get our admin user account
            models.User.findOne({
                id: 1
            }).then(function (adminUser) {
                adminEmail = adminUser.get('email');
                // Get our configuration data
                return configurationAPI.read({});
            }).then(function (configData) {
                const config = configData.configuration[0];
                // object is our passed in form data
                emailData = {
                    
                    blogName: config.blogTitle, // blog name
                    firstName: object.firstName, // the sender's name
                    lastName:  object.lastName,
                    email: object.email,
                    phone: object.phone,
                    schedule: object.schedule,
                    message: object.text, // sender's message
                };
            }).then(function () {
                // Generate the email to the admin account
                return mail.utils.generateContent({
                    data: emailData,
                    template: 'contact'
                });
            }).then(function (content) {
                // Create the mail payload for the admin email
                var payload = {
                    mail: [{
                        message: {
                            replyTo: object.contact,
                            to: adminEmail,
                            subject: emailData.blogName + ' Contact',
                            html: content.html,
                            text: content.text
                        }
                    }]
                };
                return payload;
            }).then(function (payload) {
                // Use Ghost send mail to send the message
                return sendMail(payload, options);
            }).then(function () {
                // Generate the email to the user to 
                // confirm we got their contact request
                return mail.utils.generateContent({
                    data: emailData,
                    template: 'contact-confirm'
                });
            }).then(function (content) {
                // Create the mail payload for the user email
                var payload = {
                    mail: [{
                        message: {
                            to: object.email,
                            subject: emailData.blogName + ' Contact Confirmation',
                            html: content.html,
                            text: content.text
                        }
                    }]
                };
                return payload;
            }).then(function (payload) {
                // Use Ghost send mail to send the message
                return sendMail(payload, options);
            });
        }
    
        tasks = [generateEmails];
    
        return pipeline(tasks);
    }
};

module.exports = apiMail;

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// index.js is used to setup and configure your bot

// Import required packages
const path = require('path');

// Note: Ensure you have a .env file and include the MicrosoftAppId and MicrosoftAppPassword.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

const express = require('express');
const cors = require('cors');
global.transcriptsDictionary = [];

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const {
    CloudAdapter,
    ConfigurationBotFrameworkAuthentication
} = require('botbuilder')

// This bot's main dialog.
const { ActivityBot } = require('./bots/activityBot');
const GraphHelper = require('./helpers/graphHelper');

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(process.env);
const adapter = new CloudAdapter(botFrameworkAuthentication);

// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights. See https://aka.ms/bottelemetry for telemetry 
    //       configuration instructions.

    console.error(`\n [onTurnError] unhandled error: ${error}`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${error}`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Uncomment below commented line for local debugging.
    await context.sendActivity(`Sorry, it looks like something went wrong. Exception Caught: ${error}`);

};

// Create the main dialog.

const bot = new ActivityBot();

// Create HTTP server.
const server = express();
server.use(cors());
server.use(express.json());
server.use(express.urlencoded({
    extended: true
}));

server.engine('html', require('ejs').renderFile);
server.set('view engine', 'ejs');
server.set('views', __dirname);


server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`Server listening on http://localhost:${process.env.PORT}`);
});

// Returns view to be open in task module.
server.get('/home', async (req, res) => {
    console.log("Home view requested.");
    var transcript = "Transcript not found."
    if (req.query?.meetingId) {
        var foundIndex = transcriptsDictionary.findIndex((x) => x.id === req.query?.meetingId);
            
        if (foundIndex != -1) {
            transcript = `Format: ${transcriptsDictionary[foundIndex].data}`;
        }
        else {
            var graphHelper = new GraphHelper();
            var result = await graphHelper.GetMeetingTranscriptionsAsync(req.query?.meetingId);
            if (result != "") {
                transcriptsDictionary.push({
                    id: req.query?.meetingId,
                    data: result
                });

                transcript = `Format: ${result}`;
            }
        }
    }

    res.render('./views/', { transcript: transcript });
});

server.get('/tab', async (req, res) => {
    res.render('./views/tab');
});

// Configuration page for the tab
server.get('/config', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://res.cdn.office.net/teams-js/2.19.0/js/MicrosoftTeams.min.js"></script>
    </head>
    <body>
      <h2>Botatwork MOM Bot Configuration</h2>
      <p>Click Save to add this tab to your meeting.</p>
      
      <script>
        microsoftTeams.app.initialize().then(() => {
          microsoftTeams.pages.config.registerOnSaveHandler((saveEvent) => {
            microsoftTeams.pages.config.setConfig({
              websiteUrl: "https://ernie-nontarred-unmanfully.ngrok-free.dev/tab",
              contentUrl: "https://ernie-nontarred-unmanfully.ngrok-free.dev/tab",
              entityId: "BotMeetingTab",
              suggestedDisplayName: "Botatwork MOM"
            });
            saveEvent.notifySuccess();
          });

          microsoftTeams.pages.config.setValidityState(true);
        });
      </script>
    </body>
    </html>
  `);
});

// Listen for incoming activities and route them to your bot main dialog.
server.post('/api/messages', async (req, res) => {
    console.log("Message Post requested.", req, res);
    // Route received a request to adapter for processing
    await adapter.process(req, res, (context) => bot.run(context));
});
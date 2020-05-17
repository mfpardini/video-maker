const algorithmia = require("algorithmia")
const augorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const sentenceBoundaryDetection = require('sbd')

const watsonApiKey = require('../credentials/watson-nlu.json').apikey
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1');
const { IamAuthenticator } = require('ibm-watson/auth');

const nlu = new NaturalLanguageUnderstandingV1({
    authenticator: new IamAuthenticator({ apikey: watsonApiKey }),
    version: '2018-04-05',
    url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/'
});

const state = require('./state.js')

async function robot() {
    const content = state.load()

    await fetchContentFromWikipedia(content)
    sanitizeContent(content)
    breakContentIntoSentences(content)
    limitMaximumSentences(content)
    await fetchKeywordsOfAllSentences(content)

    state.save(content)

    async function fetchContentFromWikipedia(content) {
        const term = {
            "articleName": content.searchTerm,
            "lang": "pt"
        }
        // modo feito pelo deschamps 
        const algorithmiaAuthenticated = algorithmia(augorithmiaApiKey)
        const wikipediaAlgorithm = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2')
        const wikipediaResponse = await wikipediaAlgorithm.pipe(term)
        const wikipediaContent = wikipediaResponse.get()
        content.sourceContentOriginal = wikipediaContent.content

        // meu modo copiado do site
        // não funcionou o async await
        /*
        algorithmia.client(augorithmiaApiKey)
            .algo("web/WikipediaParser/0.1.2") // timeout is optional
            .pipe(await content.searchTerm)
            .then((response) => {
                console.log(response.get());
            }); */
    }

    function sanitizeContent(content) {
        const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
        const withoutDatesInParenteses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)

        content.sourceContentSanitized = withoutDatesInParenteses

        function removeBlankLinesAndMarkdown(text) {
            const allLines = text.split('\n')
            const formatedText = allLines.filter((line) => {
                if (line.trim().length === 0 || line.trim().startsWith('=')) {
                    return false
                } else {
                    return true
                }
            })
            return formatedText.join(' ')
        }

        function removeDatesInParentheses(text) {
            return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g, ' ')
        }
    }

    function breakContentIntoSentences(content) {
        content.sentences = []
        const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
        sentences.forEach((sentence) => {
            content.sentences.push({
                text: sentence,
                keywords: [],
                images: []
            })
        })
    }

    function limitMaximumSentences(content) {
        content.sentences = content.sentences.slice(0, content.maximumSentences)
    }

    async function fetchWatsonAndReturnKeywords(sentence) {
        await nlu.analyze(
            {
                html: sentence.text,
                features: {
                    keywords: {}
                }
            })
            .then(response => {
                const keywords = response.result.keywords.map(keyword => {
                    return keyword.text;
                });
                sentence.keywords = keywords;
            })
            .catch(err => {
                console.log('error: ', err);
            });
    }

    async function fetchKeywordsOfAllSentences(content) {
        const listOfKeywordsToFetch = []

        for (const sentence of content.sentences) {
            listOfKeywordsToFetch.push(
                fetchWatsonAndReturnKeywords(sentence)
            )
        }

        await Promise.all(listOfKeywordsToFetch)
    }

}

module.exports = robot
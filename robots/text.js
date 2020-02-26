const algorithmia = require("algorithmia")
const augorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const sentenceBoundaryDetection = require('sbd')


async function robot(content) {
    await fetchContentFromWikipedia(content)
    sanitizeContent(content)
    // breakContentIntoSentences(content)

    async function fetchContentFromWikipedia(content) {
        // modo feito pelo deschamps 

        const algorithmiaAuthenticated = algorithmia(augorithmiaApiKey)
        const wikipediaAlgorithm = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2')
        const wikipediaResponse = await wikipediaAlgorithm.pipe(content.searchTerm)
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

    }
}

module.exports = robot
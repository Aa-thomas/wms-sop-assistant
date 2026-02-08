function looksProceduralQuestion(question = '') {
  return /\b(how|steps?|process|workflow|procedure|handle|perform|walk me through)\b/i.test(question);
}

function cleanPart(part) {
  return part
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\-\s]+/, '')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function splitByNumberedMarkers(text) {
  const numbered = [...text.matchAll(/(?:^|\s)(?:step\s*\d+|\d+)[).:\-]?\s+([^]+?)(?=(?:\s(?:step\s*\d+|\d+)[).:\-]?\s+)|$)/gi)];
  if (numbered.length < 2) return [];
  return numbered.map(match => cleanPart(match[1])).filter(part => part.length >= 18);
}

function splitSingleClaimIntoSteps(claim = '') {
  const text = cleanPart(claim);
  if (text.length < 80) return [];

  const numberedParts = splitByNumberedMarkers(text);
  if (numberedParts.length >= 2) return numberedParts;

  const splitPatterns = [
    /\.\s+/,
    /;\s+/,
    /,\s+(?:then|and then|next|finally|once|after that)\s+/i,
    /\s+(?:then|next|finally|after that)\s+/i
  ];

  for (const pattern of splitPatterns) {
    const parts = text.split(pattern).map(cleanPart).filter(part => part.length >= 18);
    if (parts.length >= 2) return parts;
  }

  return [];
}

function normalizeStepwiseAnswer(question, response) {
  if (!response || !Array.isArray(response.answer) || response.answer.length !== 1) {
    return response;
  }

  if (!looksProceduralQuestion(question)) {
    return response;
  }

  const first = response.answer[0];
  if (!first || typeof first.claim !== 'string') {
    return response;
  }

  if (/^not found in sops$/i.test(first.claim.trim())) {
    return response;
  }

  const parts = splitSingleClaimIntoSteps(first.claim);
  if (parts.length < 2) {
    return response;
  }

  return {
    ...response,
    answer: parts.map(part => ({
      claim: part,
      citations: Array.isArray(first.citations) ? first.citations : []
    }))
  };
}

module.exports = {
  looksProceduralQuestion,
  normalizeStepwiseAnswer,
  splitSingleClaimIntoSteps
};

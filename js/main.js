var dictionaryRanked,
    dictionaryBasic,
    pasted,
    NGRAM_THRESHOLD = 5000;

function Corpus(string){
  this.string = string;

  // PROCESS STRING
  // replace "..." with ellipsis character to make sentence splitting work
  this.string = this.string.replace(/\.\.\./g,"\u2026");

  this.text = [];
  this.sentences = [];
  var paragraphs = this.string.split("\n");
  for(var i = 0; i < paragraphs.length; i++){
    var paragraph = this.createParagraph(paragraphs[i]);
    if(paragraph!==false){
      this.text.push(paragraph);
    }
  }
  this.ngramAnalysis();
  this.basicEnglishAnalysis();
  this.sentenceReadabilityAnalysis();
}

Corpus.prototype.createParagraph = function(string){
  string = string.trim();
  if(string.length===0){
    return false;
  }

  // HACK: make sure paragraph ends with punctuation
  // if not, then add one. this fixes a bug where sentences at the
  // end of the paragraph without punctuation were disappearing
  // @todo remove this period later?
  if(string.slice(-1).match(/[\.!\?]/) == null){
    string += ".";
    var period_added = true;
  }

  var segments = string.match( /[^\.!\?]+[\.!\?]+/g );
  
  // // if no punctuation found, then treat entire string as one segment
  // if(segments==null){
  //   segments = [string];
  // }

  var sentences = [];
  var nWords = 0;
  var nComplexWords = 0;
  var nSyllables = 0;
  for(var i = 0; i < segments.length; i++){

    // HACK: remove period if we addd it earlier
    if(i + 1 == segments.length && period_added){
      segments[i] = segments[i].slice(0,-1);
    }

    var sentence = this.createSentence(segments[i]);
    if(sentence!==false){
      nWords += sentence.nWords;
      nComplexWords += sentence.nComplexWords;
      nSyllables += sentence.nSyllables;
      sentences.push(sentence);
    }
    this.sentences.push(sentence);
  }
  if(sentences.length==0){
    return false;
  }
  return {
    "type": "paragraph",
    "sentences": sentences,
    "string": string,
    "nWords": nWords,
    "nComplexWords": nComplexWords,
    "nSyllables": nSyllables,
    "nSentences": sentences.length
  };
}

Corpus.prototype.createSentence = function(string){
  string = string.trim();
  var tokens = string.split(" ");
  var words = [];
  var nComplexWords = 0;
  var nSyllables = 0;
  for(var i = 0; i < tokens.length; i++){

    var word = this.createWord(tokens[i]);
    if(word.nSyllables >= 3){
      nComplexWords++;
    }
    nSyllables += word.nSyllables;
    words.push(word);
  }
  return {
    "type": "sentence",
    "words": words,
    "string": string,
    "nWords": words.length,
    "nComplexWords": nComplexWords,
    "nSyllables": nSyllables
  };
}

Corpus.prototype.createWord = function(string){
    return {
      "type": "word",
      "token": string,
      "word": this.cleanToken(string),
      "wordSingular": this.singularizeToken(string),
      "nSyllables": this.countSyllables(this.cleanToken(string)),
      "isExcluded": this.isExcludedToken(string) // is this still needed?
    };
}


Corpus.prototype.getWordCount = function(){
  var count = 0;
  for(var i = 0; i < this.text.length; i++){
    count += this.text[i].nWords;
  }
  return count;
};

Corpus.prototype.getSyllableCount = function(){
  var count = 0;
  for(var i = 0; i < this.text.length; i++){
    count += this.text.nSyllables;
  }
  return count;
};

Corpus.prototype.getSentenceCount = function(){
  var count = 0;
  for(var i = 0; i < this.text.length; i++){
    count += this.text.nSentences;
  }
  return count;
};


Corpus.prototype.singularizeToken = function(token){
  token = this.cleanToken(token);
  return _.singularize(token);
};

Corpus.prototype.cleanToken = function(token){
  token = token.toLowerCase();

  // remove possesive "'s"
  if(token.substr(-2)==="'s"){
    token = token.substr(0, token.length - 2);
  }

  token = token.replace(/\W/g, '');
  return token;
};

Corpus.prototype.countSyllables = function(word){
// from http://stackoverflow.com/questions/5686483/how-to-compute-number-of-syllables-in-a-word-in-javascript
  word = word.toLowerCase();                                     //word.downcase!
  if(word.length <= 3) { return 1; }                             //return 1 if word.length <= 3
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');   //word.sub!(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '');                                 //word.sub!(/^y/, '')

  // try block catches words without vowels
  try{
    var matches = word.match(/[aeiouy]{1,2}/g);
    return matches.length;                    //word.scan(/[aeiouy]{1,2}/).size
  } catch(e){
    return 1;
  }
};

Corpus.prototype.isExcludedToken = function(token){
  var isEmpty = (token === "");
  var isSpace = (token == " ");
  var isNumber = (!isNaN(parseFloat(token)) && isFinite(token));
  return isEmpty || isSpace || isNumber;
};

Corpus.prototype.ngramAnalysis = function(){
  for(var i = 0; i < this.text.length; i++){
    for(var j = 0; j < this.text[i].sentences.length; j++){
      for(var k = 0; k < this.text[i].sentences[j].words.length; k++){
        var word = this.text[i].sentences[j].words[k].word;
        this.text[i].sentences[j].words[k].ngramRank = dictionaryRanked[word];
      }
    }
  }
};

Corpus.prototype.basicEnglishAnalysis = function(){
  for(var i = 0; i < this.text.length; i++){
    for(var j = 0; j < this.text[i].sentences.length; j++){
      for(var k = 0; k < this.text[i].sentences[j].words.length; k++){
        var word = this.text[i].sentences[j].words[k].word;
        var wordSingular = this.text[i].sentences[j].words[k].wordSingular;
        // check for both singularized and normal version of words to prevent bug where
        // "is" is simplified to "i" and is unfairly excluded
        var hasWord = _.contains(dictionaryBasic, word);
        var hasWordSingular = _.contains(dictionaryBasic, wordSingular);
        this.text[i].sentences[j].words[k].isBasicEnglish = hasWord || hasWordSingular; 
      }
    }
  }
};

Corpus.prototype.sentenceReadabilityAnalysis = function(){
  var SLICE_SIZE = 15; // MUST BE AN ODD NUMBER!
  var PAD = (SLICE_SIZE-1) / 2;
  var nSentences = this.sentences.length;
  for(var i = 0; i < nSentences; i++){
    var indices = [];
    if(nSentences <= SLICE_SIZE){
      indices = _.range(nSentences);
    } else if(i < PAD){
      indices = _.range(SLICE_SIZE);
    } else if((i + PAD) >= nSentences){
      indices = _.range(nSentences - SLICE_SIZE, nSentences);
    } else {
      indices = _.range(i-PAD,i+PAD+1);
    }
    var results = this.sliceReadabilityAnalysis(indices);
    this.sentences[i].readabilityEase = results.readabilityEase;
    this.sentences[i].gradeLevel = results.gradeLevel;
    this.sentences[i].smogGradeLevel = results.smogGradeLevel;
  }
};

Corpus.prototype.sliceReadabilityAnalysis = function(indices){
  var nWords = 0;
  var nSyllables = 0;
  var nComplexWords = 0;
  var nSentences = indices.length;
  for(var i = 0; i < indices.length; i++){
    nWords += this.sentences[indices[i]].nWords;
    nSyllables += this.sentences[indices[i]].nSyllables;
    nComplexWords += this.sentences[indices[i]].nComplexWords;
  }

  return {
    "readabilityEase": this.calculateReadabilityEase(nSyllables, nWords, nSentences),
    "gradeLevel": this.calculateGradeLevel(nSyllables, nWords, nSentences),
    "smogGradeLevel": this.calculateSmogGradeLevel(nComplexWords, nSentences)
  }
};

Corpus.prototype.getReadabilityEase = function(){
  return this.calculateReadabilityEase(this.getSyllableCount(), this.getWordCount(), this.getSentenceCount());
};

Corpus.prototype.getGradeLevel = function(){
  return this.calculateGradeLevel(this.getSyllableCount(), this.getWordCount(), this.getSentenceCount());
};

Corpus.prototype.calculateGradeLevel = function(nSyllables, nWords, nSentences){
  return 0.39 * (nWords / nSentences) + 11.8 * (nSyllables / nWords) - 15.59;
};

Corpus.prototype.calculateReadabilityEase = function(nSyllables, nWords, nSentences){
  return 206.835 - 1.015 * (nWords / nSentences) - 84.6 * (nSyllables / nWords);
};

Corpus.prototype.calculateSmogGradeLevel = function(nComplexWords, nSentences){
  return 1.043 * Math.sqrt(nComplexWords * (30 / nSentences)) + 3.1291;
}

var ParagraphRenderer = (function(){

  var api = {};

  LIGHTEST_RGB = 220;

  api.render = function(corpus, spanFunction){

    var html = "";
    for(var i = 0; i < corpus.text.length; i++){
      html += "<p>";
      for(var j = 0; j < corpus.text[i].sentences.length; j++){
        for(var k = 0; k < corpus.text[i].sentences[j].words.length; k++){
          if(_.isFunction(spanFunction)){
            html += spanFunction(corpus.text[i].sentences[j].words[k]);
          } else {
            html += corpus.text[i].sentences[j].words[k].token;
          }
        }
      }
      html += "</p>";
    }
    return html;
  };

  api.renderAnalyses = function(corpus, threshold){
    threshold = typeof threshold !== 'undefined' ? threshold : NGRAM_THRESHOLD;
    return api.render(corpus, function(word){
      var color = rankToColorString(word.ngramRank, threshold);
      var wordClass = word.isBasicEnglish ? "basic" : "complex";
      wordClass += word.ngramRank < threshold ? " common" : " uncommon"
      var title = "ngram rank = " + word.ngramRank;
      
      var span = "<span style='color: " + color + ";' class='" + wordClass + "' title='"+title+"'>";
      span += word.token
      span += "</span> ";
      return span;
    });
  };

  function rankToColorString(rank, threshold){
  // returns css color string
    if(rank===undefined || rank > threshold){
      var rgb = LIGHTEST_RGB;
    } else {
      rgb = Math.round(LIGHTEST_RGB * (rank / threshold));
    }
    return "rgb(" + rgb + ", " + rgb + ", " + rgb + ")";
  }

  return api;

}());

var ChartRenderer = (function(){

  var api = {};

  api.render = function(corpus){

    var nSentences = corpus.sentences.length;
    var width = nSentences * 30;

    var x = _.pluck(corpus.sentences,"string");
    x.unshift('x');

    var smog = _.pluck(corpus.sentences,"smogGradeLevel");
    for(var i = 0; i < smog.length; i++){
      smog[i] = smog[i].toFixed(1);
    }
    var upperLimit = _.max([12, _.max(smog)]);
    smog.unshift('SMOG Reading Level'); // adds name of metric for use in c3 display

    var ease = _.pluck(corpus.sentences,"readabilityEase");
    ease.unshift('ease'); // adds name of metric for use in c3 display

    var chart = c3.generate({
      data: {
        x : 'x',
        columns: [
            x, 
            smog
        ],
        type: 'spline',
        axes: {
          smog: 'y'
        }
      },
      axis: {
          x: {
              type: 'category',
              tick: {
                  rotate: 20,
                  multiline: false
              },
              height: 10 // HACK! these ticks will be hidden
          },
          y: {
            label: {
              text: 'Reading Level',
              position: 'outer-middle'
            },
            min: 6,
            max: upperLimit
          }
      },
      size: {
        height: 400,
        width: width
      },
      padding: {
        right: 200
      },
      legend: {
        show: false
      }
    });
  };

  return api;

}());

var TextRenderer = (function(){

  var api = {};

  LIGHTEST_RGB = 220;

  api.render = function(corpus, spanFunction){

    var html = "";
    for(var i = 0; i < corpus.text.length; i++){
      for(var j = 0; j < corpus.text[i].sentences.length; j++){
        var ease = corpus.text[i].sentences[j].readabilityEase;
        var level = corpus.text[i].sentences[j].gradeLevel;
        var smog = corpus.text[i].sentences[j].smogGradeLevel;
        console.log("smog = " + smog)
        html += "<div class='row'>";
        html += "<div class='col-lg-2'>";
        html += "<div class='progress'>";

        // // Display readability ease
        // html += "<div class='progress-bar' role='progressbar' aria-valuenow='" + ease + "' aria-valuemin='0' aria-valuemax='100' style='width: " + Math.floor(ease) + "%;'>";
        // html += Math.floor(ease) + "%";
        // html += "</div>";

        // Display SMOG grade level
        html += "<div class='progress-bar' role='progressbar' aria-valuenow='" + ease + "' aria-valuemin='0' aria-valuemax='12' style='width: " + Math.floor((smog/12)*100) + "%;'>";
        html += "Grade " + smog.toFixed(1);
        html += "</div>";


        html += "</div>";
        html += "</div>";
        html += "<div class='col-lg-10'>";
        html += "<p class='sentence'>";
        for(var k = 0; k < corpus.text[i].sentences[j].words.length; k++){
          if(_.isFunction(spanFunction)){
            html += spanFunction(corpus.text[i].sentences[j].words[k]);
          } else {
            html += corpus.text[i].sentences[j].words[k].token;
          }
        }
        html += "</p>";
        html += "</div>";
        html += "</div>";
      }
      html += "<hr />";
    }
    return html;
  };

  api.renderAnalyses = function(corpus, threshold){
    threshold = typeof threshold !== 'undefined' ? threshold : NGRAM_THRESHOLD;
    return api.render(corpus, function(word){
      var color = rankToColorString(word.ngramRank, threshold);
      var wordClass = word.isBasicEnglish ? "basic" : "complex";
      wordClass += word.ngramRank < threshold ? " common" : " uncommon"
      var title = "ngram rank = " + word.ngramRank;
      
      var span = "<span style='color: " + color + ";' class='" + wordClass + "' title='"+title+"'>";
      span += word.token
      span += "</span> ";
      return span;
    });
  };

  function rankToColorString(rank, threshold){
  // returns css color string
    if(rank===undefined || rank > threshold){
      var rgb = LIGHTEST_RGB;
    } else {
      rgb = Math.round(LIGHTEST_RGB * (rank / threshold));
    }
    return "rgb(" + rgb + ", " + rgb + ", " + rgb + ")";
  }

  return api;

}());

$(function(){

  var C;

  $.getJSON("js/ten-thousand-words.json", function(json) {
    dictionaryRanked = json;
  });

  $.getJSON("js/basic-english.json", function(json) {
    dictionaryBasic = json;
  });

  $("#ngram-threshold").text(NGRAM_THRESHOLD);
  $("#slider").slider({
    min: 1,
    max: 10000,
    value: NGRAM_THRESHOLD,
    range: "min",
    slide: function(e, ui){
      $("#ngram-threshold").text(ui.value);
      var results = TextRenderer.renderAnalyses(C, ui.value);
      $("#results").html(results);
    }
  });

  $("#toggle-ngram").on("change",function(e,ui){
    if($(this).is(":checked")){
      $("#results").removeClass("hide-ngram");
    } else {
      $("#results").addClass("hide-ngram");
    }
  });
  $("#toggle-basic-english").on("change",function(e,ui){
    if($(this).is(":checked")){
      $("#results").addClass("show-basic-english");
    } else {
      $("#results").removeClass("show-basic-english");
    }
  });
  $("#ngram-variable").on("change",function(e,ui){
    if($(this).is(":checked")){
      $("#results").removeClass("hide-ngram-variable-colors");
    } else {
      $("#results").addClass("hide-ngram-variable-colors");
    }
  });

  $("form#pasteForm").submit(function(event){

    // Get the pasted text
    var pastedText = $("form#pasteForm textarea#pastedText").val();
    $("form#pasteForm textarea#pastedText").attr("disabled","");
    $("form#pasteForm").hide();

    // Run processing
    C = new Corpus(pastedText);

    // // Render results
    // if($("form#pasteForm input#format-chart").is(":checked")){
    //   ChartRenderer.render(C);
    //   $("#chart").fadeIn();
    // } else {
    //   var results = TextRenderer.renderAnalyses(C);
    //   $("#results").html(results).fadeIn();
    //   $("#controls").fadeIn();      
    // }

    ChartRenderer.render(C);
    $("#chart").fadeIn();
    var results = TextRenderer.renderAnalyses(C);
    $("#results").html(results).fadeIn();
    $("#controls").fadeIn();    

    event.preventDefault();
    pasted = pastedText;
  });


});
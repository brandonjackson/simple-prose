var dictionaryRanked,
    dictionaryBasic,
    pasted,
    NGRAM_THRESHOLD = 5000;

function Corpus(string){
  this.string = string;
  this.text = [];
  var paragraphs = string.split("\n");
  for(var i = 0; i < paragraphs.length; i++){
    var words = [];
    var tokens = paragraphs[i].split(" ");
    for(var j = 0; j < tokens.length; j++){
      words.push({
        "token": tokens[j],
        "word": this.cleanToken(tokens[j]),
        "wordSingular": this.singularizeToken(tokens[j]),
        "syllables": this.countSyllables(this.cleanToken(tokens[j])),
        "isExcluded": this.isExcludedToken(tokens[j]) // is this still needed?
      });
    }
    this.text.push(words);
  }
  this.ngramAnalysis();
  this.basicEnglishAnalysis();
}

Corpus.prototype.getWordCount = function(){
  var count = 0;
  for(var i = 0; i < this.text.length; i++){
    var validWords = _.where(this.text[i],{ "isExcluded": false });
    count += validWords.length;
  }
  return count;
};

Corpus.prototype.getSyllableCount = function(){
  var count = 0;
  for(var i = 0; i < this.text.length; i++){
    for(var j = 0; j < this.text[i].length; j++){
      count += this.text[i][j].syllables;
    }
  }
  return count;
};

Corpus.prototype.getSentenceCount = function(){
  var sentences = this.string.split(/[.|!|?]\s/gi);
  return sentences.length;
};

Corpus.prototype.getReadabilityEase = function(){
  return 206.835 - 1.015 * (this.getWordCount() / this.getSentenceCount()) - 84.6 * (this.getSyllableCount() / this.getWordCount());
};

Corpus.prototype.getGradeLevel = function(){
  return 0.39 * (this.getWordCount() / this.getSentenceCount()) + 11.8 * (this.getSyllableCount() / this.getWordCount()) - 15.59;
};

Corpus.prototype.toString = function(){
  var str = ""
  var paragraph_strings = []
  _.each(this.text, function(paragraph, key){
    tokens = _.pluck(paragraph, "token");
    paragraph_strings.push(tokens.join(" "));
  });
  return paragraph_strings.join("\n");
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
  return word.match(/[aeiouy]{1,2}/g).length;                    //word.scan(/[aeiouy]{1,2}/).size
};

Corpus.prototype.isExcludedToken = function(token){
  var isEmpty = (token === "");
  var isSpace = (token == " ");
  var isNumber = (!isNaN(parseFloat(token)) && isFinite(token));
  return isEmpty || isSpace || isNumber;
};

Corpus.prototype.ngramAnalysis = function(){
  for(var i = 0; i < this.text.length; i++){
    for(var j = 0; j < this.text[i].length; j++){
      this.text[i][j].ngramRank = dictionaryRanked[this.text[i][j].word];
    }
  }
};

Corpus.prototype.basicEnglishAnalysis = function(){
  for(var i = 0; i < this.text.length; i++){
    for(var j = 0; j < this.text[i].length; j++){
      // check for both singularized and normal version of words to prevent bug where
      // "is" is simplified to "i" and is unfairly excluded
      var hasWord = _.contains(dictionaryBasic,this.text[i][j].word);
      var hasWordSingular = _.contains(dictionaryBasic,this.text[i][j].wordSingular);
      this.text[i][j].isBasicEnglish = hasWord || hasWordSingular; 
    }
  }
};

var Renderer = (function(){

  var api = {};

  LIGHTEST_RGB = 220;

  api.render = function(corpus, spanFunction){

    var html = "";
    for(var i = 0; i < corpus.text.length; i++){
      html += "<p>";
      for(var j = 0; j < corpus.text[i].length; j++){
        if(_.isFunction(spanFunction)){
          html += spanFunction(corpus.text[i][j]);
        } else {
          html += corpus.text[i][j].token;
        }
      }
      html += "</p>";
    }
    return html;
  };

  // api.renderNgrams = function(corpus, threshold){
  //   threshold = typeof threshold !== 'undefined' ? threshold : 5000;
  //   return api.render(corpus, function(word){
  //     var color = rankToColorString(word.ngramRank, threshold);
  //     var title = "ngram rank = " + word.ngramRank;
      
  //     var span = "<span style='color: " + color + ";' title='"+title+"'>";
  //     span += word.token
  //     span += "</span> ";
  //     return span;
  //   });
  // };

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
      var results = Renderer.renderAnalyses(C, ui.value);
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
    var pastedText = $("form#pasteForm textarea#pastedText").val();
    $("form#pasteForm textarea#pastedText").attr("disabled","");
    $("form#pasteForm").hide();
    C = new Corpus(pastedText);
    var results = Renderer.renderAnalyses(C);
    $("#results").html(results).fadeIn();
    $("#controls").fadeIn();
    event.preventDefault();
    pasted = pastedText;
  });


});
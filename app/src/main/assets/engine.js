/* ParaLine offline paraphrase engine.
 * Rule-based, runs fully on the device, no network, no length limit.
 * Guarantees: the number of lines never changes, blank lines / indentation /
 * bullets / numbers / links / quoted text / names are kept exactly as typed. */
(function (root) {
  'use strict';

  /* ---------- small helpers ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function matchCase(src, out) {
    if (!out) return out;
    if (src.length > 1 && src === src.toUpperCase() && /[A-Z]/.test(src)) return out.toUpperCase();
    if (src[0] !== src[0].toLowerCase()) return out[0].toUpperCase() + out.slice(1);
    return out;
  }
  var VOW = /[aeiou]/;
  function sForm(w) {
    if (/(s|x|z|ch|sh|o)$/.test(w)) return w + 'es';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    return w + 's';
  }
  function edForm(w) {
    if (/e$/.test(w)) return w + 'd';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ied';
    return w + 'ed';
  }
  function ingForm(w) {
    if (/ie$/.test(w)) return w.slice(0, -2) + 'ying';
    if (/[^e]e$/.test(w)) return w.slice(0, -1) + 'ing';
    return w + 'ing';
  }

  /* ---------- vocabulary ----------
   * A trailing "+" marks the more formal word of a group.
   * Humanize / Simple move toward plain words, Formal toward "+" words,
   * Standard / Creative pick any other member. */

  // Adjectives, adverbs, connectors: swapped as-is.
  var PLAIN = [
    'big large substantial+',
    'small little',
    'important key crucial+ essential+ vital+',
    'difficult hard tough challenging+',
    'easy straightforward+ simple-x',
    'fast quick rapid+ swift+',
    'quickly fast rapidly+ swiftly+',
    'bad poor inadequate+',
    'many numerous+',
    'main primary+ principal+ chief+',
    'obvious evident+ apparent+ clear-x',
    'clearly obviously evidently+',
    'different distinct+',
    'various several diverse+',
    'huge massive enormous immense+',
    'useful helpful handy valuable+ beneficial+',
    'widespread prevalent+ common-x',
    'rare uncommon scarce+',
    'often frequently+ regularly',
    'usually generally typically+ normally',
    'sometimes occasionally+',
    'rarely seldom+',
    'mostly mainly largely+ primarily+',
    'also additionally+',
    'really truly genuinely+',
    'especially particularly+ notably+',
    'almost nearly virtually+',
    'about roughly approximately+',
    'careful thorough',
    'carefully thoroughly',
    'strong powerful robust+',
    'smart clever intelligent+ bright',
    'happy glad pleased+ delighted+',
    'sad unhappy upset-x',
    'angry mad furious+',
    'beautiful lovely gorgeous stunning',
    'famous well-known renowned+',
    'cheap low-cost inexpensive+ affordable',
    'expensive costly pricey',
    'dangerous risky hazardous+',
    'correct right accurate+ precise+',
    'wrong incorrect+ mistaken',
    'exact precise+ accurate',
    'exactly precisely+',
    'possible feasible+ doable',
    'necessary needed required+ essential+',
    'extra additional+ added',
    'modern contemporary+',
    'recently lately',
    'fully completely totally entirely+',
    'special unique distinctive+',
    'serious severe+ grave+',
    'interesting engaging fascinating intriguing+',
    'boring dull tedious+',
    'amazing incredible remarkable+ impressive',
    'terrible awful dreadful+',
    'strange unusual peculiar+ odd-x',
    'normal usual standard typical+',
    'basic fundamental+',
    'complex complicated intricate+',
    'popular well-liked favored+',
    'reliable dependable trustworthy',
    'flexible adaptable+ versatile+',
    'rich wealthy affluent+',
    'eager keen enthusiastic+',
    'brief short concise+',
    'detailed thorough in-depth comprehensive+',
    'specific particular+ exact',
    'suitable fitting appropriate+ proper',
    'relevant related pertinent+',
    'available accessible+',
    'ready prepared',
    'final last ultimate+',
    'finally lastly eventually ultimately+',
    'instantly immediately+ at-once right-away',
    'previously+ earlier before-x',
    'now currently+ at-present+ presently+',
    'therefore thus+ hence+ consequently+',
    'furthermore+ moreover+ also-x',
    'although though even-though',
    'because since as-x',
    'maybe perhaps possibly+',
    'surely certainly definitely undoubtedly+',
    'greatly hugely significantly+ considerably+',
    'slightly a-bit somewhat+ marginally+',
    'whenever every-time',
    'nowadays these-days today-x',
    'besides apart-from aside-from',
    'essential vital+ crucial+ key',
    'significant major notable+ considerable+',
    'significantly notably+ considerably+ markedly+',
    'additional extra further+ added',
    'numerous many',
    'sufficient enough adequate+',
    'crucial key vital+ critical',
    'robust strong sturdy solid',
    'comprehensive thorough full-x complete',
    'innovative creative original',
    'seamless smooth effortless',
    'vibrant lively energetic',
    'pivotal key central crucial+',
    'intricate complex detailed',
    'meticulous careful thorough',
    'optimal ideal best-x',
    'frequently often regularly',
    'typically usually generally',
    'primarily mainly mostly',
    'approximately about roughly around',
    'subsequently later afterward',
    'additionally also',
    'consequently therefore as-a-result',
    'nevertheless still even-so nonetheless+',
    'thus therefore+',
    'hence therefore+',
    'moreover also-x besides-x',
    'ultimately finally in-the-end',
    'initially at-first originally',
    'particularly especially notably+',
    'entirely fully completely wholly+',
    'whole entire',
    'outdated dated old-x',
    'vital essential crucial+ key'
  ];

  // Nouns: "singular/plural" given only when irregular. "?" = also a common verb, needs a determiner before it.
  var NOUNS = [
    'problem issue',
    'goal aim objective+ target',
    'method approach technique+',
    'result outcome',
    'kind type sort',
    'choice option selection+ alternative+',
    'mistake error',
    'benefit advantage perk',
    'drawback downside disadvantage+ shortcoming+',
    'skill ability capability+',
    'customer client',
    'worker employee staff-member',
    'company business firm organization+',
    'manager supervisor+',
    'expert specialist professional',
    'beginner novice+ newcomer',
    'feature characteristic+ attribute+',
    'rule guideline regulation+',
    'stage phase',
    'topic subject theme+',
    'effect impact influence',
    'increase rise growth',
    'decrease drop decline+ reduction+',
    'difference distinction+',
    'example instance+ illustration+',
    'overview summary outline',
    'requirement need',
    'purpose aim goal intention+',
    'importance significance+',
    'person/people individual+',
    'child/children kid youngster+',
    'house home residence+',
    'car vehicle+',
    'picture image photo',
    'story tale narrative+',
    'trip journey',
    'shop store',
    'duty responsibility+ obligation+',
    'danger risk threat hazard+',
    'worry concern anxiety+',
    'belief opinion conviction+',
    'amount quantity+',
    'limit restriction+',
    'trend pattern tendency+',
    'aspect facet+ element',
    'factor element component+',
    'individual/individuals person/people',
    'objective goal aim',
    'methodology method approach',
    'opportunity chance'
  ];

  // Verbs: base only when regular, or "base:s,past,pp,ing" when irregular / consonant doubling.
  // Flags after "|": t = fine before "that", g = keep the -ing form untouched (it is usually a noun).
  var VERBS = [
    'use utilize+',
    'show:shows,showed,shown,showing demonstrate+ |t',
    'assist+ aid support help:helps,helped,helped,helping-x',
    'start begin:begins,began,begun,beginning commence+ kick-off-x |i',
    'finish complete |i',
    'obtain+ acquire+ get:gets,got,gotten,getting-x',
    'buy:buys,bought,bought,buying purchase+ acquire+',
    'improve enhance+ boost strengthen',
    'reduce lessen minimize+ lower-x cut:cuts,cut,cut,cutting-x decrease+-x',
    'boost strengthen increase-x raise-x',
    'need:needs,needed,needed,needing require+',
    'explain describe outline',
    'check verify+ review examine+ inspect+',
    'change alter+ modify+ adjust',
    'fix:fixes,fixed,fixed,fixing repair resolve+ correct-x',
    'choose:chooses,chose,chosen,choosing pick select+',
    'retain+ maintain+ keep:keeps,kept,kept,keeping-x',
    'allow permit:permits,permitted,permitted,permitting enable',
    'manage handle oversee:oversees,oversaw,overseen,overseeing',
    'create produce develop-x build:builds,built,built,building-x',
    'understand:understands,understood,understood,understanding grasp comprehend+ |g',
    'gather:gathers,gathered,gathered,gathering collect compile+ assemble',
    'remove delete eliminate+ take-out-x',
    'solve resolve+ tackle address-x',
    'achieve attain+ accomplish+ reach:reaches,reached,reached,reaching-x',
    'happen:happens,happened,happened,happening occur:occurs,occurred,occurred,occurring take-place-x |i',
    'protect guard:guards,guarded,guarded,guarding safeguard+ shield',
    'encourage motivate inspire urge',
    'prevent avert+ stop:stops,stopped,stopped,stopping-x',
    'require need:needs,needed,needed,needing',
    'ensure guarantee make-sure-x |t',
    'consider examine+ evaluate+ weigh:weighs,weighed,weighed,weighing-x',
    'suggest propose+ recommend:recommends,recommended,recommended,recommending |t',
    'notice observe+ detect:detects,detected,detected,detecting spot:spots,spotted,spotted,spotting-x',
    'send:sends,sent,sent,sending deliver:delivers,delivered,delivered,delivering',
    'utilize use',
    'leverage+ use apply:applies,applied,applied,applying-x',
    'facilitate enable ease-x support-x',
    'demonstrate show:shows,showed,shown,showing prove:proves,proved,proven,proving-x |t',
    'commence start begin:begins,began,begun,beginning |i',
    'purchase buy:buys,bought,bought,buying',
    'enhance improve boost strengthen:strengthens,strengthened,strengthened,strengthening',
    'underscore highlight:highlights,highlighted,highlighted,highlighting emphasize stress:stresses,stressed,stressed,stressing-x |t',
    'foster encourage nurture promote-x',
    'streamline simplify:simplifies,simplified,simplified,simplifying',
    'indicate show:shows,showed,shown,showing suggest signal:signals,signaled,signaled,signaling-x |t',
    'examine inspect:inspects,inspected,inspected,inspecting analyze+ review study:studies,studied,studied,studying-x',
    'discuss explore cover:covers,covered,covered,covering-x talk-about-x',
    'highlight:highlights,highlighted,highlighted,highlighting emphasize+ underline-x |t',
    'explore examine+ investigate+ look-into-x',
    'tackle handle confront:confronts,confronted,confronted,confronting address-x',
    'earn:earns,earned,earned,earning gain:gains,gained,gained,gaining',
    'expand broaden:broadens,broadened,broadened,broadening extend:extends,extended,extended,extending widen:widens,widened,widened,widening',
    'affect:affects,affected,affected,affecting influence impact:impacts,impacted,impacted,impacting shape-x',
    'cause trigger:triggers,triggered,triggered,triggering lead-to-x',
    'offer:offers,offered,offered,offering provide supply'
  ];

  // Multi-word rewrites. [pattern, [plain / neutral options], [formal options]]
  // An empty-string option means "drop the phrase" (the next word is re-capitalised if needed).
  var PHRASES = [
    ['in order to', ['to'], ['so as to']], ['due to the fact that', ['because', 'since'], ['given that']],
    ['in spite of the fact that', ['although', 'even though'], ['notwithstanding that']], ['despite the fact that', ['although', 'even though'], ['although']],
    ['a lot of', ['many', 'plenty of', 'lots of'], ['a great many', 'numerous']], ['lots of', ['many', 'plenty of', 'a lot of'], ['numerous', 'a great many']],
    ['a number of', ['several', 'some', 'a few'], ['several', 'various']], ['a large number of', ['many', 'lots of'], ['numerous', 'a great many']],
    ['the majority of', ['most'], ['the bulk of', 'most']], ['at this point in time', ['now', 'right now'], ['at present', 'currently']],
    ['at the present time', ['now', 'right now'], ['currently', 'at present']], ['in the event that', ['if'], ['should it happen that', 'if']],
    ['with regard to', ['about', 'on'], ['regarding', 'concerning']], ['with respect to', ['about', 'on'], ['regarding', 'concerning']],
    ['in regard to', ['about', 'on'], ['regarding', 'concerning']], ['as a result of', ['because of', 'thanks to'], ['owing to', 'as a consequence of']],
    ['as a result', ['so', 'because of this', 'that is why'], ['consequently', 'as a consequence']], ['for this reason', ['so', 'that is why'], ['accordingly', 'for that reason']],
    ['in addition to', ['besides', 'along with', 'on top of'], ['as well as', 'together with']], ['in addition', ['also', 'on top of that', 'besides'], ['additionally', 'furthermore']],
    ['on the other hand', ['then again', 'at the same time', 'but'], ['conversely', 'by contrast']], ['for example', ['for instance', 'say', 'such as'], ['for instance', 'to illustrate']],
    ['for instance', ['for example', 'say'], ['for example', 'to illustrate']], ['such as', ['like', 'for example'], ['including', 'for instance']],
    ['in conclusion', ['overall', 'all in all', 'to wrap up', 'in short'], ['to conclude', 'in summary']], ['to sum up', ['in short', 'overall', 'all in all'], ['in summary', 'to summarize']],
    ['in summary', ['in short', 'overall', 'to sum up'], ['to summarize', 'in sum']], ['in other words', ['put simply', 'that is', 'to put it another way'], ['that is to say', 'to put it differently']],
    ['as well as', ['and', 'along with', 'plus'], ['in addition to', 'together with']], ['in terms of', ['when it comes to', 'for', 'regarding'], ['with respect to', 'regarding']],
    ['when it comes to', ['for', 'with', 'in terms of'], ['regarding', 'with respect to']], ['it is important to note that', ['', 'keep in mind that', 'note that'], ['it should be noted that', 'notably,']],
    ['it is worth noting that', ['', 'note that', 'interestingly,'], ['it should be noted that', 'notably,']], ['it should be noted that', ['', 'note that'], ['it is worth noting that', 'notably,']],
    ['it is important to', ['you should', 'it helps to', 'be sure to'], ['it is essential to', 'it is vital to']], ['it is necessary to', ['you need to', 'you have to'], ['it is essential to', 'one must']],
    ['it is possible to', ['you can'], ['one can', 'it is feasible to']], ['is able to', ['can'], ['is capable of']], ['are able to', ['can'], ['are in a position to']],
    ['was able to', ['could', 'managed to'], ['succeeded in']], ['were able to', ['could', 'managed to'], ['succeeded in']],
    ['has the ability to', ['can'], ['is able to', 'has the capacity to']], ['have the ability to', ['can'], ['are able to', 'have the capacity to']],
    ['plays a crucial role in', ['matters a lot for', 'is key to', 'is central to'], ['is instrumental in', 'is central to']],
    ['plays an important role in', ['matters a lot for', 'is key to', 'is a big part of'], ['is instrumental in', 'is central to']],
    ['plays a key role in', ['matters a lot for', 'is central to', 'is a big part of'], ['is instrumental in', 'is central to']],
    ['a wide range of', ['many kinds of', 'all sorts of', 'a broad mix of'], ['a broad spectrum of', 'a wide variety of']], ['a wide variety of', ['many kinds of', 'all sorts of', 'a broad mix of'], ['a broad range of', 'a diverse array of']],
    ['a variety of', ['different', 'several', 'all kinds of'], ['a range of', 'various']], ['at the same time', ['meanwhile', 'still', 'even so'], ['simultaneously', 'concurrently']],
    ['as soon as possible', ['as quickly as possible', 'right away', 'without delay'], ['at the earliest opportunity', 'promptly']], ['right away', ['at once', 'straight away', 'immediately'], ['immediately', 'without delay']],
    ['first of all', ['first', 'to start', 'to begin with'], ['firstly', 'to begin with']], ['last but not least', ['finally', 'and lastly'], ['finally', 'lastly']],
    ['on a daily basis', ['every day', 'daily'], ['daily', 'each day']], ['on a regular basis', ['regularly', 'often'], ['regularly', 'routinely']],
    ['each and every', ['every', 'each'], ['every single', 'each']], ['in the near future', ['soon', 'before long'], ['shortly', 'in due course']],
    ['in the long run', ['over time', 'eventually', 'in the end'], ['over the long term', 'ultimately']], ['by means of', ['by', 'using', 'through'], ['through', 'via']],
    ['with the help of', ['using', 'with', 'thanks to'], ['with the aid of', 'by means of']], ['take into account', ['consider', 'keep in mind', 'factor in'], ['take into consideration', 'bear in mind']],
    ['take into consideration', ['consider', 'keep in mind', 'think about'], ['take into account', 'bear in mind']], ['make sure that', ['check that', 'be sure that'], ['ensure that', 'verify that']],
    ['make sure', ['be sure', 'check', 'double-check'], ['ensure', 'verify']], ['find out', ['learn', 'discover', 'see'], ['determine', 'ascertain']],
    ['figure out', ['work out', 'understand', 'sort out'], ['determine', 'establish']], ['deal with', ['handle', 'tackle', 'manage'], ['address', 'attend to']],
    ['come up with', ['think of', 'create', 'find'], ['devise', 'formulate']], ['look into', ['check', 'explore', 'dig into'], ['investigate', 'examine']],
    ['carry out', ['do', 'run', 'complete'], ['conduct', 'perform']], ['set up', ['create', 'arrange', 'put together'], ['establish', 'arrange']],
    ['point out', ['note', 'mention', 'say'], ['indicate', 'observe']], ['get rid of', ['remove', 'drop', 'clear out'], ['eliminate', 'dispose of']],
    ['keep in mind', ['remember', 'bear in mind', 'note'], ['bear in mind', 'take into account']], ['in my opinion', ['I think', 'to me', 'as I see it'], ['in my view', 'from my perspective']],
    ['more and more', ['increasingly', 'ever more'], ['increasingly', 'to a growing extent']], ['in today\'s world', ['today', 'these days', 'nowadays'], ['in the present day', 'at present']],
    ['in today\'s fast-paced world', ['today', 'these days', 'now that life moves so quickly'], ['in the present day', 'in contemporary life']],
    ['in the modern world', ['today', 'these days', 'nowadays'], ['in the present day', 'in contemporary society']], ['these days', ['today', 'nowadays', 'lately'], ['at present', 'currently']],
    ['delve into', ['dig into', 'look at', 'explore'], ['examine', 'explore']], ['delves into', ['digs into', 'looks at', 'explores'], ['examines', 'explores']],
    ['a testament to', ['proof of', 'a sign of', 'evidence of'], ['evidence of', 'a demonstration of']], ['in the realm of', ['in', 'within', 'in the world of'], ['within the field of', 'in the domain of']],
    ['not only', ['not just'], ['not merely']], ['is one of the most', ['ranks among the most', 'is among the most'], ['is among the most', 'ranks among the most']],
    ['there is no doubt that', ['clearly,', 'without question,', 'it is clear that'], ['undoubtedly,', 'it is beyond question that']],
    ['needless to say', ['of course', 'obviously', 'naturally'], ['naturally', 'it goes without saying that']], ['as a matter of fact', ['in fact', 'actually', 'really'], ['in fact', 'indeed']],
    ['in fact', ['actually', 'really', 'as it happens'], ['indeed', 'in reality']], ['of course', ['naturally', 'clearly', 'sure'], ['naturally', 'certainly']],
    ['in general', ['overall', 'broadly', 'on the whole'], ['generally speaking', 'on the whole']], ['on the whole', ['overall', 'in general', 'mostly'], ['in general', 'broadly speaking']],
    ['up to date', ['current', 'recent', 'the latest'], ['current', 'contemporary']], ['at all times', ['always', 'all the time'], ['constantly', 'at every moment']],
    ['at first', ['in the beginning', 'early on', 'to begin with'], ['initially', 'at the outset']], ['in the end', ['finally', 'eventually', 'at last'], ['ultimately', 'eventually']],
    ['for the purpose of', ['to', 'for'], ['with the aim of', 'in order to']], ['in the process of', ['busy', 'currently', 'in the middle of'], ['engaged in', 'in the course of']],
    ['has an impact on', ['affects', 'shapes', 'changes'], ['influences', 'bears upon']], ['have an impact on', ['affect', 'shape', 'change'], ['influence', 'bear upon']],
    ['is aimed at', ['tries to', 'is meant to', 'sets out to'], ['is intended to', 'seeks to']], ['thanks to', ['because of', 'owing to', 'with the help of'], ['owing to', 'as a result of']],
    ['because of', ['thanks to', 'owing to', 'due to'], ['owing to', 'on account of']], ['even though', ['although', 'though', 'while'], ['although', 'notwithstanding that']],
    ['as long as', ['provided', 'if', 'so long as'], ['provided that', 'on condition that']], ['so that', ['so', 'in order that'], ['in order that', 'such that']],
    ['very important', ['vital', 'crucial', 'key'], ['essential', 'of great importance']], ['very good', ['great', 'excellent', 'really good'], ['excellent', 'outstanding']],
    ['very bad', ['awful', 'terrible', 'really bad'], ['dreadful', 'extremely poor']], ['very big', ['huge', 'massive', 'enormous'], ['immense', 'substantial']],
    ['very small', ['tiny', 'really small'], ['minute', 'minimal']], ['very hard', ['really tough', 'extremely difficult'], ['extremely difficult', 'highly challenging']],
    ['very easy', ['really simple', 'effortless', 'a breeze'], ['effortless', 'extremely simple']], ['very fast', ['really quick', 'rapid', 'lightning fast'], ['extremely rapid', 'swift']],
    ['very different', ['quite unlike', 'worlds apart', 'nothing alike'], ['markedly different', 'distinct']], ['very useful', ['really handy', 'a big help', 'invaluable'], ['invaluable', 'highly beneficial']],
    ['very often', ['all the time', 'again and again', 'frequently'], ['frequently', 'with great regularity']], ['very much', ['a lot', 'a great deal', 'greatly'], ['greatly', 'considerably']]
  ];

  // Sentence openers (matched only at the start of a sentence, followed by a comma).
  var OPENERS = [
    ['however', ['still', 'that said', 'even so', 'but'], ['nevertheless', 'nonetheless']], ['therefore', ['so', 'because of this', 'for that reason'], ['consequently', 'accordingly']],
    ['moreover', ['also', 'on top of that', 'what is more'], ['furthermore', 'in addition']], ['furthermore', ['also', 'on top of that', 'besides'], ['moreover', 'in addition']],
    ['additionally', ['also', 'on top of that', 'plus'], ['furthermore', 'moreover']], ['consequently', ['so', 'as a result', 'because of this'], ['as a consequence', 'accordingly']],
    ['nevertheless', ['still', 'even so', 'all the same'], ['nonetheless', 'even so']], ['thus', ['so', 'this way'], ['consequently', 'accordingly']],
    ['hence', ['so', 'for that reason'], ['consequently', 'therefore']], ['firstly', ['first', 'to start'], ['to begin with', 'first']],
    ['secondly', ['second', 'next'], ['second', 'in the second place']], ['thirdly', ['third', 'next'], ['third', 'in the third place']],
    ['finally', ['lastly', 'last of all', 'to finish'], ['lastly', 'in closing']], ['lastly', ['finally', 'last of all'], ['finally', 'in closing']],
    ['overall', ['all in all', 'on the whole', 'in short'], ['on the whole', 'in sum']], ['indeed', ['in fact', 'truly', 'really'], ['in fact', 'certainly']],
    ['also', ['on top of that', 'besides', 'plus'], ['additionally', 'in addition']], ['so', ['because of this', 'for that reason'], ['therefore', 'consequently']],
    ['but', ['still', 'yet', 'even so'], ['however', 'nevertheless']], ['still', ['even so', 'all the same', 'yet'], ['nevertheless', 'nonetheless']],
    ['meanwhile', ['at the same time', 'in the meantime'], ['in the meantime', 'concurrently']], ['similarly', ['in the same way', 'likewise'], ['likewise', 'in like manner']],
    ['likewise', ['similarly', 'in the same way'], ['similarly', 'in like manner']], ['in short', ['put simply', 'in a nutshell', 'briefly'], ['in brief', 'to summarize']],
    ['obviously', ['clearly', 'of course', 'plainly'], ['evidently', 'clearly']], ['clearly', ['plainly', 'obviously'], ['evidently', 'manifestly']],
    ['generally', ['usually', 'in general', 'as a rule'], ['typically', 'as a rule']], ['importantly', ['above all', 'most of all', 'crucially'], ['significantly', 'notably']],
    ['notably', ['in particular', 'above all'], ['in particular', 'significantly']], ['unfortunately', ['sadly', 'regrettably'], ['regrettably']],
    ['fortunately', ['luckily', 'happily', 'thankfully'], ['happily', 'thankfully']], ['luckily', ['fortunately', 'thankfully', 'happily'], ['fortunately', 'happily']]
  ];

  var CONTRACT = [
    ['do not', "don't"], ['does not', "doesn't"], ['did not', "didn't"], ['is not', "isn't"], ['are not', "aren't"], ['was not', "wasn't"],
    ['were not', "weren't"], ['has not', "hasn't"], ['have not', "haven't"], ['had not', "hadn't"], ['will not', "won't"], ['would not', "wouldn't"],
    ['could not', "couldn't"], ['should not', "shouldn't"], ['cannot', "can't"], ['can not', "can't"], ['it is', "it's"], ['that is', "that's"],
    ['there is', "there's"], ['what is', "what's"], ['I am', "I'm"], ['I have', "I've"], ['I will', "I'll"], ['I would', "I'd"],
    ['you are', "you're"], ['you have', "you've"], ['you will', "you'll"], ['we are', "we're"], ['we have', "we've"], ['we will', "we'll"],
    ['they are', "they're"], ['they have', "they've"], ['they will', "they'll"], ['he is', "he's"], ['she is', "she's"], ['let us', "let's"]
  ];
  // "have" contractions are only safe when "have" is an auxiliary, so those are expanded but contracted
  // only when a past participle-looking word follows (handled in applyContractions).
  var AUX_HAVE = { "I've": 1, "you've": 1, "we've": 1, "they've": 1 };

  // Shorten mode: filler that can be dropped with no loss of meaning.
  var FILLER = ['basically', 'actually', 'really', 'very', 'quite', 'literally', 'essentially', 'simply', 'just', 'kind of', 'sort of',
    'in my opinion', 'as a matter of fact', 'needless to say', 'at the end of the day', 'it goes without saying that', 'for all intents and purposes'];

  /* ---------- build lookup tables ---------- */
  function clean(w) { return w.replace(/-/g, ' ').trim(); }
  var WORDS = Object.create(null); // lower form -> {type, group, idx, form}

  function reg(form, entry) { if (!WORDS[form]) WORDS[form] = entry; }

  PLAIN.forEach(function (line) {
    var items = [];
    line.split(/\s+/).forEach(function (raw) {
      var out = /-x$|-y$/.test(raw); // output-only / disabled markers
      if (/^[a-z-]+-(x|y)$/.test(raw) && line.split(/\s+/).length === 1) return;
      var formal = /\+$/.test(raw);
      var w = raw.replace(/\+$/, '').replace(/-(x|y)$/, '');
      var keepHyphen = /^(well-known|low-cost|up-to-date|in-depth|well-liked)$/.test(w);
      items.push({ w: keepHyphen ? w : clean(w), formal: formal, outOnly: out });
    });
    if (items.length < 2) return;
    var group = { type: 'a', items: items };
    items.forEach(function (it, i) { if (!it.outOnly && it.w.indexOf(' ') < 0) reg(it.w, { g: group, i: i, f: 0 }); });
  });

  NOUNS.forEach(function (line) {
    var amb = false, items = [];
    line.split(/\s+/).forEach(function (raw) {
      if (raw === '?') { amb = true; return; }
      var formal = /\+$/.test(raw);
      var parts = raw.replace(/\+$/, '').split('/');
      var sg = clean(parts[0]);
      var pl = parts[1] ? clean(parts[1]) : (sg.indexOf(' ') >= 0 ? sg.replace(/(\S+)$/, function (m) { return sForm(m); }) : sForm(sg));
      items.push({ forms: [sg, pl], formal: formal });
    });
    var group = { type: 'n', items: items, amb: amb };
    items.forEach(function (it, i) {
      it.forms.forEach(function (f, k) { if (f.indexOf(' ') < 0) reg(f, { g: group, i: i, f: k }); });
    });
  });

  VERBS.forEach(function (line) {
    var flags = '', items = [];
    var seg = line.split('|');
    if (seg[1]) flags = seg[1];
    seg[0].trim().split(/\s+/).forEach(function (raw) {
      var out = /-x$/.test(raw); raw = raw.replace(/-x$/, '');
      var formal = /\+$/.test(raw); raw = raw.replace(/\+$/, '');
      var p = raw.split(':'), base = p[0], forms;
      if (p[1]) { var r = p[1].split(','); forms = [base, r[0], r[1], r[2], r[3]]; }
      else forms = [base, sForm(base), edForm(base), edForm(base), ingForm(base)];
      if (base.indexOf('-') >= 0) { // phrasal: inflect the first word only
        var ws = base.split('-'), rest = ' ' + ws.slice(1).join(' '), h = ws[0];
        var irr = { take: ['takes', 'took', 'taken', 'taking'], make: ['makes', 'made', 'made', 'making'], lead: ['leads', 'led', 'led', 'leading'],
          look: ['looks', 'looked', 'looked', 'looking'], pick: ['picks', 'picked', 'picked', 'picking'], wrap: ['wraps', 'wrapped', 'wrapped', 'wrapping'],
          opt: ['opts', 'opted', 'opted', 'opting'], kick: ['kicks', 'kicked', 'kicked', 'kicking'], talk: ['talks', 'talked', 'talked', 'talking'],
          work: ['works', 'worked', 'worked', 'working'], smooth: ['smooths', 'smoothed', 'smoothed', 'smoothing'], respond: ['responds', 'responded', 'responded', 'responding'],
          depend: ['depends', 'depended', 'depended', 'depending'] }[h];
        if (!irr) return;
        forms = [h + rest, irr[0] + rest, irr[1] + rest, irr[2] + rest, irr[3] + rest];
      }
      items.push({ forms: forms, formal: formal, outOnly: out });
    });
    if (items.length < 2) return;
    var group = { type: 'v', items: items, okThat: flags.indexOf('t') >= 0, intr: flags.indexOf('i') >= 0, noIng: flags.indexOf('g') >= 0 };
    items.forEach(function (it, i) {
      if (it.outOnly) return;
      it.forms.forEach(function (f, k) {
        if (f.indexOf(' ') >= 0) return;
        if (k === 3 && f === it.forms[2]) return; // same as past; registered once, resolved by context
        reg(f, { g: group, i: i, f: k });
      });
    });
  });

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var PHRASE_RX = PHRASES.slice().sort(function (a, b) { return b[0].length - a[0].length; }).map(function (p) {
    return { rx: new RegExp('(^|[^A-Za-z\\uE000-\\uE00F])(' + esc(p[0]).replace(/ /g, '\\s+') + ')(?![A-Za-z])', 'gi'), plain: p[1], formal: p[2] };
  });
  var OPENER_MAP = Object.create(null);
  OPENERS.forEach(function (o) { OPENER_MAP[o[0]] = o; });

  var PARTICLES = { up: 1, off: 1, out: 1, down: 1, over: 1, away: 1, back: 1, on: 1, 'in': 1, into: 1, to: 1, through: 1, along: 1, around: 1, about: 1, across: 1, ahead: 1, forward: 1, by: 1, at: 1, 'for': 1, after: 1, 'with': 1, from: 1, like: 1 };
  var BEFORE_BASE = { to: 1, will: 1, would: 1, can: 1, could: 1, should: 1, may: 1, might: 1, must: 1, shall: 1, i: 1, you: 1, we: 1, they: 1, not: 1, "don't": 1, "doesn't": 1, "didn't": 1, "can't": 1, "won't": 1, "wouldn't": 1, "couldn't": 1, "shouldn't": 1, "cannot": 1, please: 1, "let's": 1, "we'll": 1, "you'll": 1, "they'll": 1, "i'll": 1, "it'll": 1, also: 1, always: 1, never: 1, often: 1, usually: 1, 'do': 1, does: 1, did: 1, helps: 1, help: 1, who: 1 };
  var BEFORE_S = { it: 1, he: 1, she: 1, 'this': 1, that: 1, which: 1, who: 1, also: 1, often: 1, usually: 1, always: 1, never: 1, still: 1, clearly: 1, only: 1, really: 1, simply: 1, then: 1, one: 1, everyone: 1, nobody: 1, someone: 1, anyone: 1, everything: 1, nothing: 1, something: 1 };
  var PLURAL_SUBJ = { people: 1, students: 1, users: 1, companies: 1, teams: 1, businesses: 1, customers: 1, teachers: 1, parents: 1, children: 1, readers: 1, writers: 1, developers: 1, researchers: 1, experts: 1, studies: 1, results: 1, scientists: 1, managers: 1, employees: 1, organizations: 1, governments: 1, schools: 1, tools: 1, others: 1, some: 1, most: 1, both: 1 };
  var NOOBJ = { and: 1, but: 1, or: 1, when: 1, as: 1, since: 1, because: 1, 'while': 1, 'if': 1, than: 1, so: 1, during: 1, until: 1, though: 1, although: 1, again: 1, too: 1, here: 1, there: 1, well: 1, more: 1, less: 1, now: 1, then: 1, today: 1, soon: 1, yet: 1, together: 1 };
  var DET = { the: 1, a: 1, an: 1, 'this': 1, that: 1, these: 1, those: 1, my: 1, your: 1, his: 1, her: 1, its: 1, our: 1, their: 1, some: 1, any: 1, no: 1, each: 1, every: 1, many: 1, few: 1, several: 1, one: 1, two: 1, three: 1, another: 1, other: 1, of: 1, 'in': 1, 'for': 1, 'with': 1, main: 1, 'new': 1, big: 1, first: 1, next: 1, same: 1, whose: 1, what: 1, which: 1, such: 1, both: 1, all: 1, more: 1, most: 1 };
  var PL_DET = { the: 1, these: 1, those: 1, my: 1, your: 1, his: 1, her: 1, its: 1, our: 1, their: 1, some: 1, any: 1, no: 1, many: 1, few: 1, several: 1, two: 1, three: 1, four: 1, five: 1, other: 1, of: 1, 'in': 1, 'for': 1, 'with': 1, 'new': 1, main: 1, such: 1, both: 1, all: 1, more: 1, most: 1, and: 1, or: 1, from: 1, about: 1, on: 1, by: 1 };
  var PP_BEFORE = { has: 1, have: 1, had: 1, is: 1, are: 1, was: 1, were: 1, be: 1, been: 1, being: 1, get: 1, gets: 1, got: 1, "hasn't": 1, "haven't": 1, "hadn't": 1, "isn't": 1, "aren't": 1, "wasn't": 1, "weren't": 1, "it's": 1, "that's": 1, "i've": 1, "we've": 1, "you've": 1, "they've": 1, not: 1, already: 1, just: 1, never: 1, ever: 1 };
  var BE_BEFORE = { is: 1, are: 1, was: 1, were: 1, be: 1, been: 1, being: 1, am: 1, "isn't": 1, "aren't": 1, "wasn't": 1, "weren't": 1, "it's": 1, "that's": 1, "i'm": 1, "we're": 1, "you're": 1, "they're": 1, "he's": 1, "she's": 1 };
  var AN_EXC = /^(uni[^nm]|use|usu|uti|eu|one\b|once|ubiq|u\.s)/i, A_EXC = /^(hour|honest|honou?r|heir)/i;

  /* ---------- core ---------- */
  var MODE = {
    standard: { rate: 0.55, dir: 0 }, humanize: { rate: 0.5, dir: -1 }, formal: { rate: 0.6, dir: 1 },
    simple: { rate: 0.55, dir: -1 }, creative: { rate: 0.85, dir: 0 }, shorten: { rate: 0.3, dir: -1 }
  };
  var STRENGTH = { 1: 0.55, 2: 1, 3: 1.45 };

  function pick(arr, rand) { return arr[Math.floor(rand() * arr.length)]; }

  function chooseTarget(group, srcIdx, dir, rand, rate) {
    var src = group.items[srcIdx], cands = [], force = false, i, it;
    for (i = 0; i < group.items.length; i++) {
      if (i === srcIdx) continue; it = group.items[i];
      if (dir < 0 && it.formal) continue;
      if (dir > 0 && !it.formal) continue;
      cands.push(i);
    }
    if (dir < 0 && src.formal && cands.length) force = true;      // formal word -> plain word
    if (dir > 0 && !src.formal && cands.length) force = rand() < 0.75; // plain word -> formal word
    if (dir > 0 && src.formal) {                                  // already formal: occasionally vary
      cands = []; for (i = 0; i < group.items.length; i++) if (i !== srcIdx && group.items[i].formal) cands.push(i);
      rate *= 0.4;
    }
    if (dir < 0 && !src.formal) rate *= 0.6;
    if (!cands.length) return -1;
    if (!force && rand() >= rate) return -1;
    return pick(cands, rand);
  }

  function processText(text, cfg, rand) {
    // text: one line body with protected spans already replaced by placeholders.
    var holds = cfg.holds, dir = cfg.dir, rate = cfg.rate;
    function hold(s, mark) { holds.push(s); return (mark ? '\uE010' : '') + '\uE000' + (holds.length - 1) + '\uE001'; }

    // 1. filler removal (shorten)
    if (cfg.mode === 'shorten') {
      FILLER.forEach(function (f) {
        var rx = new RegExp('(^|[\\s(])' + esc(f).replace(/ /g, '\\s+') + ',?\\s+(?=[A-Za-z])', 'gi');
        text = text.replace(rx, function (m, pre, off, str) {
          if (/^(just|very|really|quite|simply)$/i.test(f) && /\b(not|n't|is|was|are|were|be)\s*$/i.test(str.slice(0, off + pre.length))) return m;
          return pre + '\uE011';
        });
      });
    }

    // 2. sentence openers
    text = text.replace(/(^|[.!?]["')\]]?\s+)([A-Z][a-z]+(?:\s[a-z]+)?)(,)/g, function (m, pre, word, comma) {
      var o = OPENER_MAP[word.toLowerCase()];
      if (!o) return m;
      var pool = dir > 0 ? o[2] : dir < 0 ? o[1] : o[1].concat(o[2]);
      if (!pool.length || rand() >= Math.min(0.95, rate * 1.3)) return m;
      var out = pick(pool, rand);
      out = out[0].toUpperCase() + out.slice(1);
      if (/^(But|Yet|So|Plus|And)$/.test(out)) return pre + hold(out) + ' '.slice(0, 0); // no comma after short conjunctions
      return pre + hold(out) + comma;
    });
    text = text.replace(/(\uE001) (?= )/g, '$1');

    // 3. multi-word phrases
    PHRASE_RX.forEach(function (p) {
      text = text.replace(p.rx, function (m, pre, body) {
        var pool = dir > 0 ? p.formal : dir < 0 ? p.plain : p.plain.concat(p.formal);
        if (cfg.mode === 'shorten') pool = p.plain.slice().sort(function (a, b) { return a.length - b.length; }).slice(0, 1);
        if (!pool.length) return m;
        var r = cfg.mode === 'shorten' ? 0.95 : Math.min(0.95, rate * 1.35);
        if (rand() >= r) return m;
        var out = pick(pool, rand);
        if (out === '') return pre + '\uE011';
        return pre + hold(matchCase(body, out), true);
      });
    });

    // 4. single words
    var toks = text.split(/([A-Za-z]+(?:['\u2019][A-Za-z]+)?)/); // odd indexes are words
    function wordAt(i) { return i >= 0 && i < toks.length ? toks[i].toLowerCase().replace('\u2019', "'").replace(/^\uE010/, '') : ''; }
    function gap(i) { return i >= 0 && i < toks.length ? toks[i] : ''; }
    for (var i = 1; i < toks.length; i += 2) {
      var w = toks[i], lw = w.toLowerCase(), e = WORDS[lw];
      if (!e) continue;
      var before = gap(i - 1), after = gap(i + 1);
      if (/[\uE000-\uE011\-\/_@#&=+\\]$/.test(before) || /^[\-\/_@=+\\']/.test(after)) continue; // glued to something
      var sentStart = (i === 1 && /^\s*$/.test(before)) || /[.!?:]["')\]]?\s+$/.test(before) || /^\s*["'(\[]$/.test(before) && i === 1;
      if (w.length > 1 && w === w.toUpperCase()) continue;               // ACRONYM
      if (w[0] !== w[0].toLowerCase() && !sentStart) continue;           // Proper Noun
      var prev = /^\s+$/.test(before) ? wordAt(i - 2) : '';
      var next = /^\s+$/.test(after) ? wordAt(i + 2) : '';
      var g = e.g, form = e.f, t;

      if (g.type === 'v') {
        if (PARTICLES[next] || NOOBJ[next] || /ly$/.test(next)) continue;
        if (next === '' && !g.intr) continue; // needs an object after it
        if (next === 'that' && !g.okThat) continue;
        if (form === 0) { if (!(BEFORE_BASE[prev] || PLURAL_SUBJ[prev] || (WORDS[prev] && WORDS[prev].g.type === 'n' && WORDS[prev].f === 1) || (sentStart && next !== 'of' && DET[next]))) continue; if (DET[prev]) continue; }
        if (form === 1) { if (!BEFORE_S[prev]) continue; }
        if (form === 4) { if (g.noIng || DET[prev] || !(BE_BEFORE[prev] || prev === 'by' || prev === 'of' || prev === 'for' || prev === 'and' || prev === 'while' || prev === 'when' || prev === 'before' || prev === 'after' || prev === 'without' || prev === 'keep' || prev === 'start' || prev === 'not')) continue; }
        if (form === 2 || form === 3) { if (DET[prev] && !PP_BEFORE[prev]) continue; }
        t = chooseTarget(g, e.i, dir, rand, rate);
        if (t < 0) continue;
        var tf = g.items[t].forms, k = form;
        if (form === 2 && tf[2] !== tf[3]) k = PP_BEFORE[prev] ? 3 : 2;
        toks[i] = '\uE010' + matchCase(w, tf[k]);
      } else if (g.type === 'n') {
        if (g.amb && !DET[prev]) continue;
        if (form === 0 && !(DET[prev] || /^(is|was|as|per|by|on|at|from|into|without|about|than)$/.test(prev))) continue;
        if (form === 1 && !(PL_DET[prev] || (WORDS[prev] && WORDS[prev].g.type === 'a'))) continue; // avoid verbs like "it results"
        if (/^(of)$/.test(next) && form === 0 && /^(kind|sort|type|part|amount)$/.test(lw) && rand() < 0.5) continue;
        if (WORDS[next] && WORDS[next].g.type === 'n') continue; // compound noun, leave alone
        t = chooseTarget(g, e.i, dir, rand, rate);
        if (t < 0) continue;
        toks[i] = '\uE010' + matchCase(w, g.items[t].forms[form]);
      } else {
        if (/^(so|but|as|still|just|too|then|plus|also|today|yet|besides)$/.test(lw)) continue; // output-only helpers
        if (/^(since|while|though|before|now|about|only|right|last|short|set|key|plain|kind|fast|hard|later|second|current|minute|mad|fresh|bright|solid|sound|general|complete|separate|added|total|needed|required|related)$/.test(lw)) {
          // ambiguous words: only swap in clearly safe spots
          if (lw === 'about' && !/^\d|^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|\uE000)/.test(next + after.trim())) continue;
          else if (lw !== 'about' && lw !== 'now' && lw !== 'only') continue;
        }
        if ((lw === 'because' || lw === 'although') && rand() < 0.4) continue;
        if (lw === 'because' && next === 'of' || lw === 'now' && (next === 'that' || prev === 'right' || prev === 'until' || prev === 'by' || prev === 'for')) continue;
        if (lw === 'many' && next === 'of' || /^(good|bad|big|small|easy|hard|fast|strong|clear|safe)$/.test(lw) && next === 'enough' || lw === 'many' && prev === 'how' || lw === 'many' && prev === 'as' || lw === 'many' && prev === 'so' || lw === 'many' && prev === 'too') continue;
        if (lw === 'enough' && !/^(to|for)?$/.test(next) && !DET[prev]) { if (WORDS[prev] === undefined && !/^(have|has|had|is|are|not|get|got)$/.test(prev)) continue; }
        if (lw === 'enough' && prev && !/^(have|has|had|is|are|not|get|got|with|of|for)$/.test(prev)) continue; // "good enough"
        if (lw === 'little' && (prev === 'a' || prev === 'very' || prev === 'too')) continue;
        if (lw === 'good' && /^(at|for|morning|evening|night|luck|bye)$/.test(next)) continue;
        if (lw === 'right' || lw === 'whole' && prev === 'a') { if (lw === 'right') continue; }
        if (/^(more|most|less|least|very|so|too|as|how)$/.test(prev) && g.items.some(function (x) { return x.w.indexOf(' ') >= 0; })) {
          // keep "more important" style comparisons single-word
          var single = []; g.items.forEach(function (x, ix) { if (ix !== e.i && x.w.indexOf(' ') < 0 && x.w.indexOf('-') < 0) single.push(ix); });
          if (!single.length) continue;
        }
        t = chooseTarget(g, e.i, dir, rand, rate);
        if (t < 0) continue;
        var outw = g.items[t].w;
        if (/^(very|more|most|less|least|so|too|as|how|quite|really|extremely)$/.test(prev) && (outw.indexOf(' ') >= 0 || /^(huge|massive|enormous|immense|tiny|vital|essential|crucial|excellent|countless|entire|ultimate|unique|ideal|best|gorgeous|stunning|furious|delighted|incredible|awful|dreadful|key|chief|primary|principal|minute)$/.test(outw))) continue;
        if (/^(even though|every time|apart from|aside from|at once|right away|a bit|at present|on hand|in the end|at first|as a result|even so)$/.test(outw) && /[A-Za-z]/.test(after) === false && next === '') { /* fine at clause end */ }
        if (outw === 'at present' && /^(the|a|an)$/.test(prev)) continue;
        toks[i] = '\uE010' + matchCase(w, outw);
      }
    }
    text = toks.join('');

    // 5. a / an agreement in front of anything we changed
    text = text.replace(/\b(a|an|A|An)(\s+)\uE010(\uE000(\d+)\uE001|[A-Za-z]+)/g, function (m, art, sp, body, hid) {
      var nextWord = hid !== undefined ? holds[+hid] : body;
      var vowel = (VOW.test(nextWord[0].toLowerCase()) && !AN_EXC.test(nextWord)) || A_EXC.test(nextWord);
      var a = vowel ? 'an' : 'a';
      if (art[0] === 'A') a = a[0].toUpperCase() + a.slice(1);
      return a + sp + body;
    });
    text = text.replace(/\uE010/g, '');

    // 6. dropped phrases: tidy spacing / commas and re-capitalise what follows
    text = text.replace(/(^|[.!?]["')\]]?\s+|^\s*)\uE011[,]?\s*([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); });
    text = text.replace(/\uE011[,]?\s*/g, '');
    return text;
  }

  function applyContractions(text, mode, rand, rate) {
    if (mode === 'humanize') {
      CONTRACT.forEach(function (c) {
        var rx = new RegExp('(^|[^A-Za-z\'\\u2019])(' + c[0].replace(/ /g, '\\s') + ')(?=(\\s+)([A-Za-z]+)|[^A-Za-z])', c[0][0] === 'I' ? 'g' : 'gi');
        text = text.replace(rx, function (m, pre, body, sp, nxt) {
          if (rand() > 0.85) return m;
          if (!nxt) return m; // never contract at the end of a clause ("yes, it is.")
          if (AUX_HAVE[c[1]] && !/(ed|en|ne|wn|ght|ade|een|ot)$/i.test(nxt)) return m;
          if (/^(it is|that is|there is|what is|he is|she is)$/i.test(c[0]) && /^(not)$/i.test(nxt)) return m;
          return pre + matchCase(body, c[1]);
        });
      });
    } else if (mode === 'formal') {
      CONTRACT.forEach(function (c) {
        if (/'s$/.test(c[1]) && c[1] !== "let's") return; // "it's" may be "it has": leave alone
        if (c[1] === "I'd") return;
        var rx = new RegExp('(^|[^A-Za-z])(' + c[1].replace("'", "['\\u2019]") + ')(?![A-Za-z])', c[1][0] === 'I' ? 'g' : 'gi');
        var full = c[0] === 'can not' ? 'cannot' : c[0];
        text = text.replace(rx, function (m, pre, body) { return pre + matchCase(body, full); });
      });
    }
    return text;
  }

  var PROTECT = /(```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|"[^"\n]{1,400}"|\u201C[^\u201D\n]{1,400}\u201D|[@#][A-Za-z0-9_]+|\{\{[^}\n]*\}\}|\$\{[^}\n]*\}|<[^<>\n]{1,200}>|\b[A-Za-z]:\\[^\s]+|\b\d[\d,.:\/-]*\s?(?:%|[A-Za-z]{1,4}\b)?)/g;
  var PREFIX = /^(\s*(?:(?:[-*+\u2022\u25E6\u25AA\u2023\u2013\u2014>]|\d{1,3}[.)]|[A-Za-z][.)]|\(\w{1,3}\)|#{1,6}|\[[ xX]?\])\s+)*)/;

  function paraphraseLine(line, opts, rand) {
    if (!/[A-Za-z]{2}/.test(line)) return line;         // blank, numbers only, or a non-Latin script: untouched
    var prefix = (line.match(PREFIX) || [''])[0];
    var body = line.slice(prefix.length);
    var trail = (body.match(/\s+$/) || [''])[0];
    body = body.slice(0, body.length - trail.length);
    if (!body) return line;
    var m = MODE[opts.mode] || MODE.standard;
    var cfg = { mode: opts.mode, dir: m.dir, rate: Math.min(0.97, m.rate * (STRENGTH[opts.strength] || 1)), holds: [] };
    body = body.replace(/[\uE000-\uE011]/g, '');
    body = body.replace(PROTECT, function (s) { cfg.holds.push(s); return '\uE000' + (cfg.holds.length - 1) + '\uE001'; });
    body = processText(body, cfg, rand);
    body = applyContractions(body, opts.mode, rand, cfg.rate);
    for (var guard = 0; guard < 3 && /\uE000/.test(body); guard++) {
      body = body.replace(/\uE000(\d+)\uE001/g, function (x, n) { return cfg.holds[+n]; });
    }
    if (/^[a-z]/.test(body) && /^[A-Z]/.test(line.slice(prefix.length))) body = body[0].toUpperCase() + body.slice(1);
    return prefix + body + trail;
  }

  /** Paraphrase a whole text. The result always has exactly as many lines as the input. */
  function paraphrase(text, opts) {
    opts = opts || {};
    var o = { mode: opts.mode || 'standard', strength: opts.strength || 2 };
    var rand = rng(opts.seed === undefined ? (Date.now() & 0xffffffff) : opts.seed);
    var eol = /\r\n/.test(text) ? '\r\n' : '\n';
    var lines = text.split(/\r\n|\n|\r/), inFence = false;
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*(```|~~~)/.test(lines[i])) { inFence = !inFence; continue; }
      if (inFence) continue;
      try { lines[i] = paraphraseLine(lines[i], o, rand); } catch (err) { /* keep the original line on any failure */ }
    }
    return lines.join(eol);
  }

  /* ---------- diff / statistics ---------- */
  function words(s) { return s.match(/[A-Za-z0-9\u00C0-\uFFFF]+(?:['\u2019][A-Za-z]+)?|[^\sA-Za-z0-9\u00C0-\uFFFF]/g) || []; }

  /** Returns, for one output line, the list of [text, changed] runs versus the original line. */
  function diffLine(a, b) {
    var norm = function (w) { return w.toLowerCase().replace(/^[^a-z0-9\u00C0-\uFFFF]+|[^a-z0-9\u00C0-\uFFFF]+$/g, ''); };
    var A = a.split(/\s+/).filter(Boolean).map(norm), parts = b.split(/(\s+)/), B = [], pos = [];
    parts.forEach(function (p, i) { if (i % 2 === 0 && p) { B.push(norm(p)); pos.push(i); } });
    var setA = Object.create(null), keep = [];
    if (A.length * B.length > 250000) { // very long line: cheap membership test
      A.forEach(function (w) { setA[w] = 1; }); B.forEach(function (w, i) { keep[i] = !!setA[w] || w === ''; });
    } else {
      var n = A.length, m = B.length, dp = [], i, j;
      for (i = 0; i <= n; i++) { dp.push(new Uint16Array(m + 1)); }
      for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      i = 0; j = 0;
      while (i < n && j < m) { if (A[i] === B[j]) { keep[j] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
      B.forEach(function (w, k) { if (w === '') keep[k] = true; });
    }
    var runs = [], changed = 0, idx = 0;
    parts.forEach(function (p, i) {
      if (!p) return;
      if (i % 2 === 1) { runs.push([p, false]); return; }
      var ch = !keep[idx++]; if (ch) changed++;
      runs.push([p, ch]);
    });
    return { runs: runs, changed: changed, total: B.length };
  }

  function countWords(s) { var m = s.match(/\S+/g); return m ? m.length : 0; }

  var api = { paraphrase: paraphrase, paraphraseLine: paraphraseLine, diffLine: diffLine, countWords: countWords, rng: rng, PREFIX: PREFIX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ParaEngine = api;
})(typeof self !== 'undefined' ? self : this);

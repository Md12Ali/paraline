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
    'vital essential crucial+ key',
    'everyone everybody',
    'someone somebody',
    'anyone anybody',
    'nice pleasant lovely',
    'tired worn-out weary+',
    'worried concerned anxious',
    'excited thrilled',
    'surprised amazed astonished+',
    'scared afraid frightened',
    'funny amusing humorous+',
    'tasty delicious',
    'busy occupied+',
    'great wonderful fantastic excellent+ superb+',
    'probably most-likely presumably+',
    'actually in-fact',
    'basically essentially fundamentally+',
    'suddenly all-of-a-sudden abruptly+',
    'easily effortlessly with-ease',
    'again once-more once-again',
    'until till',
    'awesome amazing incredible',
    'quiet peaceful calm',
    'huge-x',
    'certain sure-x confident',
    'lucky fortunate+',
    'totally completely fully entirely+',
    'extremely very-x incredibly highly+',
    'kids-x'
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
    'opportunity chance',
    '? help assistance+ support',
    'money cash funds/funds',
    'teacher instructor+ educator+',
    'student learner pupil',
    'doctor physician+',
    'country nation',
    'question query+',
    '? answer response reply/replies',
    'job role position+',
    'friend companion+ buddy',
    'present-x',
    'movie film',
    'error mistake',
    'aim goal objective+',
    'issue problem'
  ];

  // Verbs: base only when regular, or "base:s,past,pp,ing" when irregular / consonant doubling.
  // Flags after "|": t = fine before "that", g = keep the -ing form untouched (it is usually a noun).
  var VERBS = [
    'use utilize+ make-use-of-x',
    'show:shows,showed,shown,showing demonstrate+ |t',
    'assist+ aid support help:helps,helped,helped,helping-x',
    'start begin:begins,began,begun,beginning commence+ |i',
    'finish complete |i',
    'obtain+ acquire+ get:gets,got,gotten,getting-x',
    'buy:buys,bought,bought,buying purchase+ get:gets,got,gotten,getting-x',
    'improve enhance+ boost strengthen',
    'reduce lessen minimize+ lower-x cut:cuts,cut,cut,cutting-x decrease+-x',
    'boost strengthen increase-x raise-x',
    'need:needs,needed,needed,needing require+',
    'explain describe',
    'check verify+ review examine+ inspect+',
    'change alter+',
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
    'offer:offers,offered,offered,offering provide supply',
    'enjoy relish+ like:likes,liked,liked,liking-x |g',
    'believe think:thinks,thought,thought,thinking-x |t g',
    'remember recall',
    'receive obtain+ get:gets,got,gotten,getting-x',
    'discover find:finds,found,found,finding-x |g',
    'locate+ find:finds,found,found,finding-x |g',
    'construct+ build:builds,built,built,building-x |g',
    'inform+ tell:tells,told,told,telling-x',
    'possess+ own:owns,owned,owned,owning have:has,had,had,having-x',
    'desire+ want:wants,wanted,wanted,wanting-x',
    'depart+ leave:leaves,left,left,leaving-x',
    'request+ ask-for-x'
  ];

  // Multi-word rewrites. [pattern, [plain / neutral options], [formal options]]
  // An empty-string option means "drop the phrase" (the next word is re-capitalised if needed).
  var PHRASES = [
    ['thank you very much for', ['thanks a lot for', 'many thanks for', 'I really appreciate'], ['I am very grateful for', 'many thanks for']],
    ['thank you so much for', ['thanks a lot for', 'many thanks for', 'I really appreciate'], ['I am very grateful for', 'many thanks for']],
    ['thank you very much', ['thanks a lot', 'many thanks', 'thanks so much'], ['many thanks', 'I am most grateful']],
    ['thank you so much', ['thanks a lot', 'many thanks', 'thank you very much'], ['many thanks', 'I am most grateful']],
    ['in order to', ['to'], ['so as to']], ['due to the fact that', ['because', 'since'], ['given that']],
    ['in spite of the fact that', ['although', 'even though'], ['although']], ['despite the fact that', ['although', 'even though'], ['although']],
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
    ['because of', ['thanks to', 'owing to', 'due to'], ['owing to', 'on account of']], ['even though', ['although', 'though', 'while'], ['although']],
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


  // Everyday patterns. [regex source, plain options, formal options, guards]
  // "$1" / "$2" re-insert what the brackets in the source matched.
  // guards: d = not after a determiner (so nouns are not mistaken for verbs), q = not after an auxiliary
  // (questions such as "Do you want to"), w = not inside a what/how question.
  var EVERY = [
    ["I (?:cannot|can not|can't)", ["I can't", "I'm not able to"], ['I am unable to', 'I am not able to'], 'q'],
    ["(you|we|they) (?:cannot|can not|can't)", ["$1 can't", "$1 aren't able to"], ['$1 are unable to'], 'q'],
    ["(he|she|it) (?:cannot|can not|can't)", ["$1 can't", "$1 isn't able to"], ['$1 is unable to'], 'q'],
    ["I can(?= [a-z])(?! not| be )", [], ['I am able to'], 'q'],
    ["(you|we|they) can(?= [a-z])(?! not| be )", [], ['$1 are able to'], 'q'],
    ["(he|she|it) can(?= [a-z])(?! not| be )", [], ['$1 is able to'], 'q'],
    ["I will(?= [a-z])(?! not)", ["I'll", "I'm going to"], [], 'q'],
    ["(you|we|they) will(?= [a-z])(?! not)", ["$1 are going to", "$1'll"], [], 'q'],
    ["(he|she|it) will(?= [a-z])(?! not)", ["$1 is going to", "$1'll"], [], 'q'],
    ["I must(?= [a-z])(?! not| be | have )", ['I have to', 'I need to'], [], 'q'],
    ["(you|we|they) must(?= [a-z])(?! not| be | have )", ['$1 have to', '$1 need to'], [], 'q'],
    ["(he|she|it) must(?= [a-z])(?! not| be | have )", ['$1 has to', '$1 needs to'], [], 'q'],
    ["(I|you|we|they|he|she|it) should(?= [a-z])(?! not| be | have )", ['$1 ought to'], ['$1 ought to'], 'q'],
    ["(I|we|they|you) want to", ['$1 would like to', "$1'd like to"], ['$1 wish to', '$1 would like to'], 'q'],
    ["(he|she) wants to", ['$1 would like to', "$1'd like to"], ['$1 wishes to', '$1 would like to'], 'q'],
    ["(I|we|they|you|he|she) wanted to", ['$1 hoped to'], ['$1 wished to', '$1 intended to'], 'q'],
    ["(I|we|they|you) need to", ['$1 have to', '$1 must'], ['$1 must'], 'q'],
    ["(he|she|it) needs to", ['$1 has to', '$1 must'], ['$1 must'], 'q'],
    ["(I|we|they|you) have to", ['$1 need to', '$1 must'], ['$1 must', '$1 need to'], 'q'],
    ["(he|she|it) has to", ['$1 needs to', '$1 must'], ['$1 must', '$1 needs to'], 'q'],
    ["(I|we|they|you|he|she|it) had to", ['$1 needed to'], ['$1 needed to'], 'q'],
    ["(I|we|they|you) (really |also |always |both |all )?like(?= [a-z])(?! to )", ['$1 $2enjoy'], ['$1 $2enjoy'], 'q'],
    ["(he|she) (really |also |always )?likes(?= [a-z])(?! to )", ['$1 $2enjoys'], ['$1 $2enjoys'], 'q'],
    ["(I|we|they|you) (really |also |always |both |all )?love(?= [a-z])(?! to )", ['$1 $2adore'], ['$1 $2cherish'], 'q'],
    ["(I|we|they|you) (really |also )?hate(?= [a-z])(?! to )", ["$1 $2can't stand", '$1 $2dislike'], ['$1 $2dislike', '$1 $2detest'], 'q'],
    ["I think(?= [a-z])(?! about| of | so| not)", ['I believe', 'I feel', "I'd say"], ['I believe'], 'q'],
    ["(we|they|you) think(?= [a-z])(?! about| of | so| not)", ['$1 believe', '$1 feel'], ['$1 believe'], 'q'],
    ["(he|she) thinks(?= [a-z])(?! about| of | so| not)", ['$1 believes', '$1 feels'], ['$1 believes'], 'q'],
    ["I know that", ["I'm aware that", 'I understand that', 'I realize that'], ['I am aware that', 'I recognize that'], 'q'],
    ["I hope(?= (?:that|you|it|this|we|they|he|she|the|your|everything|all)\\b)", ["I'm hoping", 'I trust'], ['I trust'], 'q'],
    ["(?:I am|I'm) sorry(?! to| that| but| if| about| for your)", ['I apologize'], ['I apologize', 'I sincerely apologize']],
    ["(?:I am|I'm) sure", ["I'm certain", "I'm confident", 'I have no doubt'], ['I am certain', 'I am confident']],
    ["(is|are|was|were) sure", ['$1 certain', '$1 confident'], ['$1 certain']],
    ["(?:I do not|I don't) know(?= (?:if|whether|what|why|how|where|when|who|which)\\b| ?[.,!?]|$)", ["I'm not sure", 'I have no idea'], ['I am not certain', 'I am unsure']],
    ["my name is", ["I'm", 'I am', "I'm called"], ['I am']],
    ["I live in", ["I'm based in", 'my home is in'], ['I reside in'], 'q'],
    ["(we|they|you) live in", ['$1 are based in'], ['$1 reside in'], 'q'],
    ["(he|she) lives in", ['$1 is based in'], ['$1 resides in'], 'q'],
    ["thank you for", ['thanks for', 'I appreciate', 'many thanks for'], ['I am grateful for', 'I appreciate']],
    ["thanks for", ['thank you for', 'I appreciate'], ['thank you for', 'I am grateful for']],
    ["how are you(?! doing| feeling| going| getting)", ['how are you doing', "how's it going", 'how have you been'], ['how are you doing', 'how have you been']],
    ["(?:I am|I'm) fine", ["I'm doing well", "I'm good", "I'm all right"], ['I am well', 'I am doing well']],
    ["(?:I am|I'm) good at", ["I'm skilled at", 'I do well at'], ['I am skilled at']],
    ["(is|are|was|were) good at", ['$1 skilled at', '$1 great at'], ['$1 skilled at', '$1 adept at']],
    ["(is|are|was|were|be|been|it's|that's|becomes|became|gets|got|seems|looks|find it|finds it|found it|make it|makes it|made it)( not)?( very| really| so| too| quite| pretty| extremely)? hard(?! work| drive| copy| disk)", ['$1$2$3 difficult', '$1$2$3 tough'], ['$1$2$3 difficult', '$1$2$3 challenging']],
    ["a good (idea|way|example|chance|option|choice|reason|job|time|place|start|result|friend|person|student|teacher|boy|girl|man|woman|day|book|movie|film|plan|question|point|thing|life|school|company|product|price|habit|mood|grade|mark|score)", ['a great $1', 'a fine $1'], ['an excellent $1', 'a fine $1']],
    ["(is|are|was|were) good(?= ?[.,!?;]| and | but |$)", ['$1 great', '$1 really good'], ['$1 excellent']],
    ["good for", ['great for', 'helpful for'], ['beneficial for', 'advantageous for']],
    ["bad for", ['harmful to', 'not good for'], ['harmful to', 'detrimental to']],
    ["bad (weather|quality|result|results|service|grade|grades|performance|decision|choice|condition|conditions|health)", ['poor $1'], ['poor $1']],
    ["big (mistake|problem|difference|decision|step|change|changes|challenge|issue|impact|effect|role|part|risk|success|improvement|advantage)", ['major $1', 'huge $1'], ['significant $1', 'major $1', 'considerable $1']],
    ["small (mistake|problem|difference|change|changes|issue|detail|details)", ['minor $1'], ['minor $1']],
    ["very(?= (?!much|few|little|first|last|same|best|own|end|well|next|least|most|many|beginning|top|bottom|good|important|big|small|hard|easy|fast|different|useful|often|bad)[a-z]+)", ['really', 'extremely', 'incredibly'], ['extremely', 'exceptionally']],
    ["a lot(?= ?[.,!?;]|$)", ['very much', 'a great deal', 'so much'], ['a great deal', 'considerably']],
    ["as well(?= ?[.,!?;]|$)", ['too'], []],
    ["a (?:little )?bit(?= [a-z])(?! of)", ['slightly', 'a little', 'somewhat'], ['slightly', 'somewhat']],
    ["every day(?!,)", ['each day', 'daily'], ['each day', 'daily']],
    ["every day(?=,)", ['each day'], ['each day']],
    ["(we|I) look forward to", ['$1 really look forward to', '$1 very much look forward to'], ['$1 eagerly anticipate'], 'q'],
    ["I would like to", ["I'd like to", 'I want to', "I'd love to"], ['I wish to'], 'q'],
    ["was approved", ['got the go-ahead', 'was given the green light'], ['received approval', 'was authorized']],
    ["were approved", ['got the go-ahead', 'were given the green light'], ['received approval', 'were authorized']],
    ["every (week|month|year|morning|night|evening|weekend|time)", ['each $1'], ['each $1']],
    ["all the time(?= ?[.,!?;]|$| and | but | because )", ['constantly', 'always', 'nonstop'], ['constantly', 'continually']],
    ["at the moment", ['right now', 'currently', 'for now'], ['at present', 'currently']],
    ["right now", ['at the moment', 'currently'], ['at present', 'currently']],
    ["in the past(?! few| several| two| three| five| ten| decade| century| year| month| week| \\d)", ['previously', 'back then'], ['previously', 'formerly', 'historically']],
    ["in the future", ['down the road', 'going forward', 'later on'], ['in time to come', 'going forward']],
    ["all over the world", ['around the world', 'worldwide', 'across the globe'], ['worldwide', 'across the globe', 'throughout the world']],
    ["around the world", ['all over the world', 'worldwide', 'across the globe'], ['worldwide', 'across the globe']],
    ["for a long time", ['for ages', 'for quite a while'], ['for an extended period', 'for a considerable time']],
    ["a long time ago", ['long ago', 'ages ago', 'way back'], ['long ago']],
    ["at last(?! year| week| month| night| count| minute)", ['finally', 'in the end'], ['finally', 'eventually']],
    ["by the way", ['incidentally', 'on another note'], ['incidentally']],
    ["come back", ['return'], ['return'], 'd'], ["comes back", ['returns'], ['returns'], 'd'], ["came back", ['returned', 'got back'], ['returned']], ["coming back", ['returning'], ['returning']],
    ["go back to", ['return to', 'head back to'], ['return to'], 'd'], ["went back to", ['returned to', 'headed back to'], ['returned to']],
    ["going back to", ['returning to', 'heading back to'], ['returning to']], ["goes back to", ['returns to'], ['returns to']],
    ["(I|we|they|you|he|she) went to(?! sleep| bed| great| work on| see| get| buy| do| the trouble)", ['$1 headed to'], ['$1 proceeded to'], 'q'],
    ["(I|we|they|you) go to(?! sleep| bed| great| see| get| buy| do)", ['$1 head to'], [], 'q'],
    ["(he|she) goes to(?! sleep| bed)", ['$1 heads to'], [], 'q'],
    ["take care of", ['look after', 'care for'], ['care for', 'attend to']], ["takes care of", ['looks after', 'cares for'], ['cares for', 'attends to']],
    ["took care of", ['looked after', 'cared for'], ['cared for', 'attended to']], ["taking care of", ['looking after', 'caring for'], ['caring for', 'attending to']],
    ["take part in", ['join in', 'participate in'], ['participate in', 'engage in']], ["takes part in", ['joins in', 'participates in'], ['participates in']],
    ["took part in", ['joined in', 'participated in'], ['participated in', 'engaged in']], ["taking part in", ['joining in', 'participating in'], ['participating in']],
    ["make a decision", ['decide', 'make a choice'], ['reach a decision', 'decide']], ["made a decision", ['decided', 'made a choice'], ['reached a decision', 'decided']],
    ["making a decision", ['deciding'], ['reaching a decision']],
    ["look for", ['search for', 'hunt for'], ['seek', 'search for'], 'd'], ["looks for", ['searches for'], ['seeks', 'searches for'], 'd'],
    ["looked for", ['searched for', 'hunted for'], ['sought', 'searched for']], ["looking for", ['searching for', 'hunting for'], ['seeking', 'searching for']],
    ["look at", ['take a look at', 'check out'], ['examine', 'view'], 'd'], ["looked at", ['took a look at', 'checked out'], ['examined', 'viewed']],
    ["looking at", ['checking out', 'taking a look at'], ['examining', 'viewing']], ["looks at", ['takes a look at'], ['examines', 'views'], 'd'],
    ["talk about", ['discuss', 'speak about'], ['discuss'], 'd'], ["talks about", ['discusses', 'speaks about'], ['discusses'], 'd'],
    ["talked about", ['discussed', 'spoke about'], ['discussed']], ["talking about", ['discussing', 'speaking about'], ['discussing']],
    ["think about", ['consider', 'reflect on'], ['consider', 'reflect on'], 'w'], ["thinks about", ['considers'], ['considers', 'reflects on'], 'w'],
    ["thought about", ['considered', 'reflected on'], ['considered', 'reflected on'], 'dw'], ["thinking about", ['considering', 'reflecting on'], ['considering', 'reflecting on'], 'w'],
    ["ask for", ['request'], ['request'], 'd'], ["asked for", ['requested'], ['requested']], ["asks for", ['requests'], ['requests']], ["asking for", ['requesting'], ['requesting']],
    ["wait for", [], ['await'], 'd'], ["waiting for", [], ['awaiting']], ["waited for", [], ['awaited']],
    ["arrived (?:at|in)", ['reached', 'got to'], ['reached']], ["arrive (?:at|in)", ['reach', 'get to'], ['reach']], ["arrives (?:at|in)", ['reaches', 'gets to'], ['reaches']],
    ["plan to", ['intend to', 'aim to', 'mean to'], ['intend to', 'aim to'], 'd'], ["plans to", ['intends to', 'aims to'], ['intends to', 'aims to'], 'd'],
    ["planned to", ['intended to', 'meant to'], ['intended to', 'aimed to']], ["planning to", ['intending to', 'aiming to', 'looking to'], ['intending to', 'aiming to']],
    ["try to", ['attempt to', 'aim to', 'make an effort to'], ['attempt to', 'endeavor to', 'seek to'], 'd'], ["tries to", ['attempts to', 'aims to'], ['attempts to', 'endeavors to', 'seeks to']],
    ["tried to", ['attempted to', 'made an effort to'], ['attempted to', 'endeavored to', 'sought to']], ["trying to", ['attempting to', 'aiming to', 'working to'], ['attempting to', 'endeavoring to', 'seeking to']],
    ["start to", ['begin to'], ['begin to'], 'd'], ["starts to", ['begins to'], ['begins to'], 'd'], ["started to", ['began to'], ['began to']], ["starting to", ['beginning to'], ['beginning to']],
    ["begin to", ['start to'], [], 'd'], ["began to", ['started to'], []], ["begins to", ['starts to'], []],
    ["(start|starts|started)(?= [a-z]+ing\\b)", ['$1'], ['$1']],
    ["decide to", ['choose to', 'opt to'], ['elect to', 'choose to'], 'd'], ["decides to", ['chooses to', 'opts to'], ['elects to', 'chooses to']],
    ["decided to", ['chose to', 'opted to'], ['elected to', 'chose to', 'resolved to']],
    ["seems to", ['appears to'], ['appears to']], ["seem to", ['appear to'], ['appear to']], ["seemed to", ['appeared to'], ['appeared to']],
    ["it seems that", ['it appears that', 'it looks like'], ['it appears that', 'it would seem that']], ["it seems(?! to| that| like)", ['it appears'], ['it appears']],
    ["said that", ['mentioned that', 'stated that', 'pointed out that', 'explained that'], ['stated that', 'noted that', 'remarked that']],
    ["says that", ['states that', 'notes that', 'mentions that', 'points out that'], ['states that', 'notes that', 'asserts that'], 'd'],
    ["say that", ['state that', 'claim that', 'mention that'], ['state that', 'assert that', 'maintain that'], 'd'],
    ["told (me|us|him|her|them) that", ['let $1 know that', 'informed $1 that'], ['informed $1 that', 'advised $1 that']],
    ["let me know", ['tell me'], ['inform me', 'notify me']],
    ["feel free to", ["don't hesitate to", "you're welcome to"], ['please do not hesitate to', 'you are welcome to']],
    ["get in touch with", ['contact', 'reach out to'], ['contact']], ["reach out to", ['contact', 'get in touch with'], ['contact'], 'd'],
    ["as you know", ["as you're aware", 'as you probably know'], ['as you are aware']],
    ["is called", ['is known as', 'is named'], ['is known as', 'is termed', 'is referred to as']], ["are called", ['are known as', 'are named'], ['are known as', 'are termed', 'are referred to as']],
    ["is full of", ['is filled with', 'is packed with', 'is loaded with'], ['is filled with', 'is replete with', 'abounds with']],
    ["are full of", ['are filled with', 'are packed with'], ['are filled with', 'are replete with']],
    ["is different from", ['differs from', 'is unlike'], ['differs from', 'is distinct from']], ["are different from", ['differ from', 'are unlike'], ['differ from', 'are distinct from']],
    ["is similar to", ['resembles', 'is much like', 'is close to'], ['resembles', 'is comparable to', 'is akin to']],
    ["are similar to", ['resemble', 'are much like'], ['resemble', 'are comparable to', 'are akin to']],
    ["is known for", ['is famous for', 'is recognized for'], ['is renowned for', 'is noted for']], ["is famous for", ['is known for', 'is well known for'], ['is renowned for', 'is celebrated for']],
    ["depends on", ['relies on', 'hinges on', 'comes down to'], ['relies on', 'is contingent on', 'hinges on']], ["depend on", ['rely on', 'hinge on', 'count on'], ['rely on', 'hinge on']],
    ["depended on", ['relied on', 'hinged on'], ['relied on']], ["depending on", ['based on', 'according to'], ['according to', 'contingent on']],
    ["leads to", ['results in', 'causes', 'brings about'], ['results in', 'gives rise to', 'brings about'], 'd'], ["lead to", ['result in', 'cause', 'bring about'], ['result in', 'give rise to', 'bring about'], 'd'],
    ["led to", ['resulted in', 'caused', 'brought about'], ['resulted in', 'gave rise to', 'brought about']], ["leading to", ['resulting in', 'causing', 'bringing about'], ['resulting in', 'giving rise to']],
    ["results in", ['leads to', 'causes', 'brings about'], ['leads to', 'gives rise to'], 'd'], ["result in", ['lead to', 'cause', 'bring about'], ['lead to', 'give rise to'], 'd'],
    ["resulted in", ['led to', 'caused', 'brought about'], ['led to', 'gave rise to']],
    ["due to(?= (?:the|a|an|its|their|his|her|my|our|your|this|that|these|those|some|many|high|low|lack|poor|bad|heavy|[a-z]+tion|[a-z]+ment|[a-z]+ness|[a-z]+ity)\\b)(?! the fact)", ['because of', 'thanks to', 'owing to'], ['owing to', 'as a result of', 'on account of']],
    ["focus on", ['concentrate on', 'center on', 'zero in on'], ['concentrate on', 'center on'], 'd'], ["focuses on", ['concentrates on', 'centers on'], ['concentrates on', 'centers on'], 'd'],
    ["focused on", ['concentrated on', 'centered on'], ['concentrated on', 'centered on']], ["focusing on", ['concentrating on', 'centering on'], ['concentrating on', 'centering on']],
    ["dealt with", ['handled', 'tackled', 'addressed'], ['addressed', 'handled']], ["deals with", ['handles', 'tackles', 'covers'], ['addresses', 'handles', 'concerns'], 'd'],
    ["dealing with", ['handling', 'tackling', 'facing'], ['addressing', 'handling']],
    ["comes from", ['originates from', 'stems from'], ['originates from', 'stems from', 'derives from']], ["come from", ['originate from', 'stem from'], ['originate from', 'stem from', 'derive from']],
    ["came from", ['originated from', 'stemmed from'], ['originated from', 'stemmed from', 'derived from']],
    ["is used to(?= (?!the\\b|a\\b|an\\b|it\\b|this\\b|that\\b|[a-z]+ing\\b)[a-z]+)", ['serves to', 'helps to', 'works to'], ['serves to', 'is employed to', 'is utilized to']],
    ["are used to(?= (?!the\\b|a\\b|an\\b|it\\b|this\\b|that\\b|[a-z]+ing\\b)[a-z]+)", ['serve to', 'help to'], ['serve to', 'are employed to', 'are utilized to']],
    ["is used for", ['is meant for', 'is designed for'], ['is employed for', 'is utilized for', 'is intended for']],
    ["are used for", ['are meant for', 'are designed for'], ['are employed for', 'are utilized for', 'are intended for']],
    ["is important(?= ?[.,;!?]|$| because | and | but )", ['matters', 'counts', 'is key'], ['is essential', 'is of importance', 'is vital']],
    ["are important(?= ?[.,;!?]|$| because | and | but )", ['matter', 'count', 'are key'], ['are essential', 'are vital']],
    ["is (?:the|a) key to", ['is essential for', 'is the secret to', 'is central to', 'is the way to'], ['is essential to', 'is fundamental to', 'is central to']],
    ["is one of the(?! most)", ['is among the', 'ranks among the'], ['is among the', 'ranks among the']], ["are some of the", ['are among the', 'rank among the'], ['are among the']],
    ["one of the most", ['among the most'], ['among the most']],
    ["people who", ['those who', 'folks who'], ['those who', 'individuals who'], 'd'], ["someone who", ['a person who', 'somebody who'], ['a person who', 'an individual who']],
    ["no one", ['nobody'], []], ["each other", ['one another'], ['one another']], ["one another", ['each other'], ['each other']],
    ["help (me|us|him|her|them|you) with", ['give $1 a hand with', 'assist $1 with', 'support $1 with'], ['assist $1 with', 'support $1 with'], 'd'],
    ["helped (me|us|him|her|them|you) with", ['gave $1 a hand with', 'assisted $1 with'], ['assisted $1 with', 'supported $1 with']],
    ["near the", ['close to the', 'by the'], ['close to the', 'in the vicinity of the']],
    ["next to", ['beside', 'by', 'right by'], ['beside', 'adjacent to', 'alongside']], ["close to", ['near'], ['near']],
    ["do you want to", ['would you like to'], ['would you like to', 'do you wish to']],
    ["do you want(?! to)", ['would you like'], ['would you like']],
    ["can you(?= [a-z])", ['could you', 'would you be able to'], ['could you', 'would you be able to']],
    ["can I(?= [a-z])", ['could I', 'may I'], ['may I', 'might I']],
    ["could you please", ['can you please', 'would you mind if I asked you to'], ['would you kindly', 'would you please']],
    ["what do you think (?:about|of)", ["what's your opinion on", 'how do you feel about', "what's your take on"], ['what is your opinion on', 'what is your view of']],
    ["how can I", ['how do I', "what's the best way to"], ['how may I', 'in what way can I']],
    ["why don't we", ['how about we', 'what if we'], ['shall we', 'might we']],
    ["do you have(?= [a-z])", ['have you got', 'do you happen to have'], ['do you possess', 'do you happen to have']],
    ["is it possible to", ['can we', 'is there a way to'], ['would it be possible to', 'might it be possible to']],
    ["are you sure", ['are you certain', 'are you positive'], ['are you certain']],
    ["do you know(?= (?:if|whether|what|why|how|where|when|who|which)\\b)", ['do you happen to know', 'any idea'], ['are you aware', 'do you happen to know']],
    [", but", [', yet', ', though'], [', yet']],
    [", so(?= (?:i|you|he|she|it|we|they|the|my|this|that|there)\\b)", [', which is why', ', and so'], [', and therefore', ', and consequently']]
  ];
  // Words that begin a sentence with no comma after them.
  var STARTS = {
    Then: [['After that,', 'Next,', 'Afterward,'], ['Subsequently,', 'Thereafter,', 'Following that,']],
    And: [['Also,', 'Plus,', 'On top of that,'], ['In addition,', 'Furthermore,', 'Moreover,']],
    But: [['Still,', 'Yet', 'Even so,'], ['However,', 'Nevertheless,', 'Nonetheless,']],
    So: [['Because of this,', 'As a result,', 'For that reason,'], ['Therefore,', 'Consequently,', 'As a result,']],
    Also: [['On top of that,', 'Besides,', 'Plus,'], ['Additionally,', 'In addition,', 'Furthermore,']],
    Hello: [['Hi', 'Hey'], []],
    Hi: [['Hello', 'Hey'], ['Hello']]
  };
  var START_BEGIN = { started: 'began', starts: 'begins', start: 'begin' };
  var AUXQ = /(?:^|[^A-Za-z])(?:do|does|did|don't|doesn't|didn't|will|would|can|could|should|may|might|must|let|lets|make|makes|made|help|helps|helped|see|saw|watch|watched|hear|heard)\s+$/i;
  var DETQ = /(?:^|[^A-Za-z])(?:the|a|an|my|our|their|his|her|your|this|that|any|no|each|every|its|main|new|next|first|same|whole|good|big|great|quick|closer)\s+$/i;
  var WHQ = /(?:^|[^A-Za-z])(?:what|how)\b[^.!?]*$/i;
  var EVERY_RX = EVERY.map(function (e) {
    return { rx: new RegExp("(^|[^A-Za-z'\\u2019\\uE000-\\uE011]|\\b(?=[,;]))(" + e[0].replace(/ /g, '\\s') + ")(?![A-Za-z])", 'gi'), plain: e[1], formal: e[2], guards: e[3] || '' };
  });

  // Sentence reshaping helpers.
  var LOWERABLE = {};
  ('the a an he she it we they you my your his her our their this that these those there people many some most all students children everyone someone nobody ' +
    'parents teachers each every both several few no one two when if as in on at for to with by from education technology success life love time money learning ' +
    'reading writing working today now here what who everything nothing something anyone').split(' ').forEach(function (w) { LOWERABLE[w] = 1; });
  function lowerFirst(clause) {
    var m = /^([A-Za-z']+)/.exec(clause);
    if (!m) return null;
    var w = m[1];
    if (w === 'I' || /^I'/.test(w)) return clause;
    if (w.length > 1 && w === w.toUpperCase()) return clause;
    var lw = w.toLowerCase();
    if (LOWERABLE[lw] || WORDS[lw] || (lw.length > 5 && /(ing|tion|ment|ness|ity|ance|ence)$/.test(lw))) return lw + clause.slice(w.length);
    return null; // probably a name: leave the sentence alone
  }
  function upperFirst(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
  var TIME = "today|tomorrow|yesterday|every (?:day|week|month|year|morning|night|evening)|each (?:day|week|month|year)|last (?:night|week|month|year)|next (?:week|month|year)|this (?:morning|week|month|year|evening)|right now|these days|nowadays|at the moment";
  var COORD = /(?:^|[^A-Za-z])(?:and|but|or|because|so|if|when|while|that|which|who|although|since|after|before|until|unless|then)(?![A-Za-z])/i;
  var SUBJ = "(?:I|you|he|she|it|we|they|the|this|that|there|my|his|her|our|their|its|people|someone|everyone)\\b";
  var RX_TIME_END = new RegExp('^([A-Z][^,;:()\\uE000-\\uE011]*?) (' + TIME + ')([.!])$', 'i');
  var RX_TIME_START = new RegExp('^(' + TIME + '), ([^,;:()\\uE000-\\uE011]+?)([.!])$', 'i');
  var RX_BUT = new RegExp('^([A-Z][^,;:()]{8,}?),? but (' + SUBJ + '[^,;:()]{4,})([.!])$');
  var RX_BECAUSE = /^([A-Z][^,;:()]{6,}?) because ((?!of\b)[^,;:()]{6,})([.!])$/;
  var RX_BECAUSE_START = /^Because ((?!of\b)[^,;:()]{6,}), ([^,;:()]{6,})([.!])$/;
  var RX_IF_START = /^(If|When) ([^,;:()]{4,}), ([^,;:()?]{4,})([.!])$/;
  var RX_IF_END = new RegExp('^([A-Z][^,;:()]{6,}?) (if|when) (' + SUBJ + '[^,;:()]{3,})([.!])$');
  var RX_SO = new RegExp('^([A-Z][^,;:()]{6,}), so (' + SUBJ + '[^,;:()]{4,})([.!])$');
  var NO_IF_MOVE = /(?:^|[^A-Za-z])(?:know|knows|knew|wonder|wonders|wondered|ask|asks|asked|sure|see|check|tell|decide|matter|matters|care|doubt|remember|understand|determine|whether|that|and|but|or|time|day|moment|what|how|why|where|as)(?![A-Za-z])/i;
  var CONCESSION = /^(Although|Though|While|If|When|Because|Since|Even|Unless|As)\b/;

  function reshapeSentence(s, cfg, rand) {
    var m, a, opts = [];
    if ((m = RX_TIME_END.exec(s)) && !COORD.test(m[1]) && m[1].split(' ').length >= 3 && m[1].split(' ').length <= 14 && (a = lowerFirst(m[1]))) {
      opts.push(upperFirst(m[2].toLowerCase()) + ', ' + a + m[3]);
    } else if ((m = RX_TIME_START.exec(s)) && !COORD.test(m[2]) && m[2].split(' ').length >= 3) {
      opts.push(upperFirst(m[2]) + ' ' + m[1].toLowerCase() + m[3]);
    }
    if ((m = RX_BUT.exec(s)) && !CONCESSION.test(m[1]) && !/ but /.test(m[1]) && (a = lowerFirst(m[1]))) {
      var lead = cfg.mode === 'simple' ? ['Although'] : cfg.dir > 0 ? ['Although', 'While'] : ['Although', 'Even though', 'While'];
      opts.push(pick(lead, rand) + ' ' + a + ', ' + m[2] + m[3]);
    }
    if ((m = RX_BECAUSE.exec(s)) && !/because|(?:^|[^A-Za-z])(?:that|said|says|say|think|thinks|thought|believe|believes|know|knows|told|tell|feel|feels)(?![A-Za-z])/i.test(m[1]) && !CONCESSION.test(m[1]) && (a = lowerFirst(m[1]))) {
      opts.push(pick(['Because', 'Since'], rand) + ' ' + m[2] + ', ' + a + m[3]);
    } else if ((m = RX_BECAUSE_START.exec(s))) {
      opts.push(upperFirst(m[2]) + ' because ' + m[1] + m[3]);
    }
    if ((m = RX_IF_START.exec(s)) && !/^(so|then)\b/i.test(m[3])) {
      opts.push(upperFirst(m[3]) + ' ' + m[1].toLowerCase() + ' ' + m[2] + m[4]);
    } else if ((m = RX_IF_END.exec(s)) && !NO_IF_MOVE.test(m[1]) && !CONCESSION.test(m[1]) && (a = lowerFirst(m[1]))) {
      opts.push(upperFirst(m[2]) + ' ' + m[3] + ', ' + a + m[4]);
    }
    if ((m = RX_SO.exec(s)) && !CONCESSION.test(m[1]) && !COORD.test(m[1]) && (a = lowerFirst(m[1]))) {
      opts.push(pick(['Because', 'Since'], rand) + ' ' + a + ', ' + m[2] + m[3]);
    }
    if (!opts.length || rand() >= Math.min(0.92, cfg.rate * 0.75)) return s;
    return pick(opts, rand);
  }

  function reshape(text, cfg, rand) {
    var parts = text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*|[.!?]+\s*/g);
    if (!parts) return text;
    for (var i = parts.length - 2; i >= 0; i--) { // keep "Mr. Smith", "e.g. this" together
      if (/(?:^|[^A-Za-z])(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|No|Inc|Ltd|Jr|Sr)\.\s*$/.test(parts[i])) { parts[i] += parts[i + 1]; parts.splice(i + 1, 1); }
    }
    return parts.map(function (part) {
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(part);
      if (!m[2] || /[\uE010\uE011]/.test(m[2])) return part;
      return m[1] + reshapeSentence(m[2], cfg, rand) + m[3];
    }).join('');
  }

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
          depend: ['depends', 'depended', 'depended', 'depending'], ask: ['asks', 'asked', 'asked', 'asking'], go: ['goes', 'went', 'gone', 'going'] }[h];
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
  var AMB_NOUN = {};
  ('issue aim target approach result type sort benefit perk firm feature attribute rule stage phase subject effect impact influence increase rise decrease drop decline ' +
    'outline need individual kid house home picture trip journey shop store risk worry concern amount limit trend factor chance kind mistake professional help support ' +
    'answer reply response place change plan position role film question cash query pattern element story case object summary').split(' ').forEach(function (w) { AMB_NOUN[w] = 1; AMB_NOUN[sForm(w)] = 1; });
  var COMPOUND_NEXT = {};
  ('service services support care name names policy car account accounts data base list number id team plan model owner size level rate type system center centre ' +
    'experience feedback satisfaction book bus work life card cards review reviews page pages website site app store shop price prices order orders').split(' ').forEach(function (w) { COMPOUND_NEXT[w] = 1; });
  var NOT_PLURAL = { always: 1, sometimes: 1, perhaps: 1, across: 1, besides: 1, towards: 1, afterwards: 1, nowadays: 1, whereas: 1, unless: 1, process: 1, business: 1, success: 1, access: 1, address: 1, class: 1, focus: 1, status: 1, bonus: 1, campus: 1, virus: 1, series: 1, news: 1, physics: 1, mathematics: 1, economics: 1, politics: 1 };
  var SING_SUBJ = /^(company|teacher|student|system|tool|app|software|study|research|report|government|school|team|book|article|author|writer|program|website|machine|device|method|plan|person|man|woman|child|boy|girl|mother|father|friend|manager|doctor|[a-z]{3,}(?:tion|ment|ness|ity|ance|ence|ology|ship|ism))$/;
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
  // Which options a style may use. Neutral styles lean towards everyday wording.
  function poolFor(plain, formal, dir, rand) {
    if (dir > 0) return formal;
    if (dir < 0) return plain;
    if (!plain.length) return formal;
    if (!formal.length) return plain;
    return rand() < 0.72 ? plain : formal;
  }

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
    if (dir === 0) { // neutral styles: mostly everyday words
      var plainOnes = cands.filter(function (c) { return !group.items[c].formal; });
      if (plainOnes.length && plainOnes.length < cands.length && rand() < 0.72) cands = plainOnes;
    }
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
          if (/^very$/i.test(f) && /^(much|few|little|first|last|same|best|own|end|well|least|most|many)\b/i.test(str.slice(off + m.length))) return m;
          return pre + '\uE011';
        });
      });
    }

    // 1b. reshape whole sentences (move a time phrase, turn "A but B" into "Although A, B", and so on)
    text = reshape(text, cfg, rand);

    // 2. sentence openers
    text = text.replace(/(^|[.!?]["')\]]?\s+)([A-Z][a-z]+(?:\s[a-z]+)?)(,)/g, function (m, pre, word, comma) {
      var o = OPENER_MAP[word.toLowerCase()];
      if (!o) return m;
      var pool = poolFor(o[1], o[2], dir, rand);
      if (!pool.length || rand() >= Math.min(0.95, rate * 1.3)) return m;
      var out = pick(pool, rand);
      out = out[0].toUpperCase() + out.slice(1);
      if (/^(But|Yet|So|Plus|And)$/.test(out)) return pre + hold(out) + ' '.slice(0, 0); // no comma after short conjunctions
      return pre + hold(out) + comma;
    });
    text = text.replace(/(\uE001) (?= )/g, '$1');

    // 2b. sentence starters that have no comma ("Then you ...", "But he ...")
    text = text.replace(/(^|[.!?]["')\]]?\s+)(Then|And|But|So|Also|Hello|Hi)(?=(,?)\s+([A-Za-z']+))/g, function (m, pre, word, comma, nxt) {
      var o = STARTS[word], greet = word === 'Hello' || word === 'Hi';
      if (comma && !greet) return m;
      if (word === 'So' && /^(what|why|how|who|where|when|far|much|many|long|do|did|does|is|are|can|will|should|that)$/i.test(nxt)) return m;
      var pool = poolFor(o[0], o[1], dir, rand);
      if (!pool.length || rand() >= Math.min(0.95, rate * 1.2)) return m;
      return pre + hold(pick(pool, rand));
    });

    // 3. multi-word phrases
    PHRASE_RX.forEach(function (p) {
      text = text.replace(p.rx, function (m, pre, body) {
        var pool = poolFor(p.plain, p.formal, dir, rand);
        if (cfg.mode === 'shorten') pool = p.plain.slice().sort(function (a, b) { return a.length - b.length; }).slice(0, 1);
        if (!pool.length) return m;
        var r = cfg.mode === 'shorten' ? 0.95 : Math.min(0.95, rate * 1.35);
        if (rand() >= r) return m;
        var out = pick(pool, rand);
        if (out === '') return pre + '\uE011';
        return pre + hold(matchCase(body, out), true);
      });
    });

    // 3b. everyday patterns
    EVERY_RX.forEach(function (p) {
      text = text.replace(p.rx, function (m, pre, body) {
        var args = arguments, off = args[args.length - 2], str = args[args.length - 1];
        var pool = poolFor(p.plain, p.formal, dir, rand);
        if (!pool.length) return m;
        var before = str.slice(0, off + pre.length);
        if (p.guards.indexOf('q') >= 0 && AUXQ.test(before)) return m;
        if (p.guards.indexOf('d') >= 0 && DETQ.test(before)) return m;
        if (p.guards.indexOf('w') >= 0 && WHQ.test(before)) return m;
        if (rand() >= Math.min(0.95, rate * 1.25)) return m;
        var out = pick(pool, rand).replace(/\$(\d)/g, function (x, n) { var v = args[2 + (+n)]; return v === undefined ? '' : v; });
        if (/^(start|starts|started)$/i.test(body)) out = START_BEGIN[body.toLowerCase()];
        if (out.toLowerCase() === body.toLowerCase()) return m;
        if (/^I(?![a-z])/.test(body)) { if (/(^|[.!?]["')\]]*\s+)$/.test(before) || !/\S/.test(before)) out = upperFirst(out); }
        else if (!/^I(?![a-z])/.test(out)) out = matchCase(body, out);
        return pre + hold(out, true);
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
        if (prev === 'would' && lw === 'like') continue;
        if (form === 0) { if (!(BEFORE_BASE[prev] || PLURAL_SUBJ[prev] || (WORDS[prev] && WORDS[prev].g.type === 'n' && WORDS[prev].f === 1) || (/[a-z]{3,}[^s']s$/.test(prev) && !NOT_PLURAL[prev]) || (sentStart && next !== 'of' && DET[next]))) continue; if (DET[prev]) continue; }
        if (form === 1) { if (!(BEFORE_S[prev] || (WORDS[prev] && WORDS[prev].g.type === 'n' && WORDS[prev].f === 0) || SING_SUBJ.test(prev))) continue; if (DET[prev] && !BEFORE_S[prev]) continue; }
        if (form === 4) { if (g.noIng || DET[prev] || !(BE_BEFORE[prev] || prev === 'by' || prev === 'of' || prev === 'for' || prev === 'and' || prev === 'while' || prev === 'when' || prev === 'before' || prev === 'after' || prev === 'without' || prev === 'keep' || prev === 'start' || prev === 'not')) continue; }
        if (form === 2 || form === 3) { if (DET[prev] && !PP_BEFORE[prev]) continue; }
        t = chooseTarget(g, e.i, dir, rand, rate);
        if (t < 0) continue;
        var tf = g.items[t].forms, k = form;
        if (form === 2 && tf[2] !== tf[3]) k = PP_BEFORE[prev] ? 3 : 2;
        toks[i] = '\uE010' + matchCase(w, tf[k]);
      } else if (g.type === 'n') {
        if (g.amb && !DET[prev]) continue;
        if (AMB_NOUN[lw]) { // also a verb or adverb: only swap where it is clearly a noun
          if (form === 0 && !(DET[prev] || /^(is|was|as|per|by|on|at|from|into|without|about|than)$/.test(prev))) continue;
          if (form === 1 && !(PL_DET[prev] || (WORDS[prev] && WORDS[prev].g.type === 'a'))) continue;
        }
        if (COMPOUND_NEXT[next]) continue;
        if (/^(kind|kinds|sort|sorts|type|types)$/.test(lw) && next !== 'of') continue;
        if (lw === 'home' && !DET[prev] || prev === 'at' && /^(home|house)$/.test(lw)) continue;
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
        if (lw === 'nice' && next === 'to' || lw === 'great' && /^(deal|many|number|amount|extent|britain)$/.test(next) || /^(afraid|scared|certain)$/.test(lw) && /^(that|so|not|to|of)$/.test(next) && lw !== 'scared') continue;
        if (lw === 'tired' && next === 'of' || lw === 'again' && (prev === 'and' || next === 'and' || prev === 'once') || lw === 'certain' && !BE_BEFORE[prev]) continue;
        if (lw === 'big' && /^(brother|sister|idea|ideas|deal|fan|day|name|picture|data|time|boy|girl|bang|mistake|problem|difference|decision|step|change|changes|challenge|issue|impact|effect|role|part|risk|success|improvement|advantage)$/.test(next)) continue;
        if (lw === 'quiet' && next !== '' && !/^(and|but|or)$/.test(next) && !BE_BEFORE[prev]) continue;
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
    if (mode !== 'humanize' && mode !== 'formal') { // neutral styles: sometimes switch whichever form the line uses
      if (rand() >= Math.min(0.9, rate * 0.6)) return text;
      mode = /[A-Za-z]['\u2019](?:t|m|re|ve|ll|s|d)(?![A-Za-z])/.test(text) && mode !== 'simple' ? 'formal' : 'humanize';
    }
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

  function rewriteBody(body, mode, rate, rand) {
    var m = MODE[mode] || MODE.standard;
    var cfg = { mode: mode, dir: m.dir, rate: rate, holds: [] };
    body = body.replace(/[\uE000-\uE011]/g, '');
    body = body.replace(PROTECT, function (s) { cfg.holds.push(s); return '\uE000' + (cfg.holds.length - 1) + '\uE001'; });
    body = processText(body, cfg, rand);
    body = applyContractions(body, mode, rand, cfg.rate);
    for (var guard = 0; guard < 3 && /\uE000/.test(body); guard++) {
      body = body.replace(/\uE000(\d+)\uE001/g, function (x, n) { return cfg.holds[+n]; });
    }
    return body.replace(/[\uE000-\uE011]/g, '');
  }

  // How much of a line has to change, per strength, before the result is accepted.
  var TARGET = { 1: 0.01, 2: 0.14, 3: 0.24 };

  function paraphraseLine(line, opts, rand) {
    if (!/[A-Za-z]{2}/.test(line)) return line;         // blank, numbers only, or a non-Latin script: untouched
    var prefix = (line.match(PREFIX) || [''])[0];
    var body = line.slice(prefix.length);
    var trail = (body.match(/\s+$/) || [''])[0];
    body = body.slice(0, body.length - trail.length);
    if (!body) return line;
    var m = MODE[opts.mode] || MODE.standard, strength = STRENGTH[opts.strength] ? opts.strength : 2;
    var base = Math.min(0.97, m.rate * STRENGTH[strength]);
    var wordCount = (body.match(/[A-Za-z]+/g) || []).length;
    var target = wordCount < 4 ? 0 : TARGET[strength], best = body, bestScore = -1;
    var rates = [base, Math.min(0.97, base * 1.5), 5, 5, 5]; // 5 = take every safe rewrite that applies
    for (var attempt = 0; attempt < rates.length; attempt++) {
      var out = rewriteBody(body, opts.mode, rates[attempt], rand);
      if (/^[a-z]/.test(out) && /^[A-Z]/.test(body)) out = out[0].toUpperCase() + out.slice(1);
      var d = out === body ? { changed: 0, total: 1 } : diffLine(body, out);
      var score = d.total ? d.changed / d.total : 0;
      if (out !== body && score === 0) score = 0.02; // only spacing or word order changed
      if (score > bestScore) { best = out; bestScore = score; }
      if (bestScore >= target) break;
    }
    return prefix + best + trail;
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

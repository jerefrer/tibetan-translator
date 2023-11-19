// Won't probably be of any use but let's store it for now

var Tokenizer = function( tokenizers, doBuild ){
  if( !(this instanceof Tokenizer ) )
    return new Tokenizer( tokenizers, onEnd, onFound );

  this.tokenizers = tokenizers.splice ? tokenizers : [tokenizers];
  if( doBuild )
    this.doBuild = doBuild;
};

Tokenizer.prototype = {
  parse:function( src ){
    this.src = src;
    this.ended = false;
    this.tokens = [ ];
    do this.next(); while( !this.ended );
    return this.tokens;
  },
  build:function( src, real ){
    if( src )
      this.tokens.push(
        !this.doBuild ? src :
        this.doBuild(src,real,this.tkn)
      );
  },
  next:function(){
    var self = this,
      plain;

    self.findMin();
    plain = self.src.slice(0, self.min);

    self.build( plain, false );

    self.src = self.src.slice(self.min).replace(self.tkn,function( all ){
      self.build(all, true);
      return '';
    });

    if( !self.src )
      self.ended = true;
  },
  findMin:function(){
    var self = this, i=0, tkn, idx;
    self.min = -1;
    self.tkn = '';

    while(( tkn = self.tokenizers[i++]) !== undefined ){
      idx = self.src[tkn.test?'search':'indexOf'](tkn);
      if( idx != -1 && (self.min == -1 || idx < self.min )){
        self.tkn = tkn;
        self.min = idx;
      }
    }
    if( self.min == -1 )
      self.min = self.src.length;
  }
};

var terms = [];
var termBuffer = '';
var tokenizer = new Tokenizer(
  [
    '&', '[', ']', '{', '}'
  ],
  (chunk, isSeparator) => {
    const pushTerm = () => {
      if (termBuffer) {
        terms.push(termBuffer);
        termBuffer = '';
      }
    }
    if (isSeparator && (chunk == '[' || chunk == '{'))
      pushTerm();
    if (chunk != '&')
      termBuffer += chunk.trim();
    if (isSeparator && (chunk == ']' || chunk == '}' || chunk == '&'))
      pushTerm();
  }
);
tokenizer.parse("ཀློད་{ki} & sang[gye] & buddha");
terms.push(termBuffer);
// terms = terms.compact(true);
console.log(terms);
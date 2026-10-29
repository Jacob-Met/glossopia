const author='starter-author';
const word=(id,role,meaning,form,gloss,rationale)=>({id,role,meaning,form,gloss,author,rationale,canonical:true});
export const starterLanguage={
  schemaVersion:1,languageId:'luma',versionId:'luma-v1',number:1,parentVersionId:null,name:'Luma',author,
  rationale:'An original, deliberately small starter language for this trading mission. These forms and rules are authored examples, not claims about a natural language.',
  grammar:{order:'SOV',quantityPosition:'before-object',author,rationale:'Version 1 places the speaker first, then a quantity and object, and the action last. The quantity stays directly before its object.'},
  lexicon:[
    word('actor-i','actor','i','mi','I','The speaker refers to themself.'),
    word('actor-you','actor','you','tu','you','The speaker addresses the other participant.'),
    word('verb-request','verb','request','na','want / request','Asks for an item; speaking this verb alone does not transfer it.'),
    word('verb-give','verb','give','di','give','Names a transfer from the speaker, subject to the mission state.'),
    word('verb-have','verb','have','si','have','States possession; it does not create inventory.'),
    word('object-lantern','object','lantern','lum','lantern','The useful item needed for the evening crossing.'),
    word('object-pear','object','pear','pon','pear','The item offered in this market exchange.'),
    word('quantity-one','quantity',1,'un','one','Exactly one item.'),
    word('quantity-two','quantity',2,'du','two','Exactly two items.'),
    word('quantity-three','quantity',3,'tri','three','Exactly three items.')
  ],
  examples:[
    {id:'inventory-start',text:'mi tri pon si',meaning:{actor:'i',verb:'have',object:'pear',quantity:3},note:'Describe your starting inventory.'},
    {id:'request-lantern',text:'mi un lum na',meaning:{actor:'i',verb:'request',object:'lantern',quantity:1},note:'Ask the trader for one lantern.'},
    {id:'merchant-price',text:'mi du pon na',meaning:{actor:'i',verb:'request',object:'pear',quantity:2},note:'Spoken by the trader: I want two pears.'},
    {id:'give-pears',text:'mi du pon di',meaning:{actor:'i',verb:'give',object:'pear',quantity:2},note:'Offer the two pears after hearing the price.'},
    {id:'merchant-receipt',text:'tu un lum si',meaning:{actor:'you',verb:'have',object:'lantern',quantity:1},note:'Spoken by the trader after the exchange: you have one lantern.'},
    {id:'confirm-lantern',text:'mi un lum si',meaning:{actor:'i',verb:'have',object:'lantern',quantity:1},note:'Confirm that the lantern is now yours.'}
  ]
};
export const starterMission={
  id:'light-for-the-crossing',title:'A light for the crossing',
  premise:'The evening path is unlit. A trader has a lantern, and you have three pears. Make the exchange in Luma: ask for one lantern, give two pears, then confirm what you received.',
  opening:'The trader points to a lantern and holds up two fingers. What will you say?',
  initialInventory:{pear:3,lantern:0},finalInventory:{pear:1,lantern:1},
  price:{object:'pear',quantity:2},reward:{object:'lantern',quantity:1},
  stages:[
    {id:'request',title:'Ask for a lantern',goal:'Request exactly one lantern for yourself.',expected:{actor:'i',verb:'request',object:'lantern',quantity:1},exampleId:'request-lantern',traderReplyExampleId:'merchant-price'},
    {id:'give',title:'Make the exchange',goal:'Give the trader exactly two pears.',expected:{actor:'i',verb:'give',object:'pear',quantity:2},exampleId:'give-pears',traderReplyExampleId:'merchant-receipt'},
    {id:'confirm',title:'Confirm what you received',goal:'Say that you now have one lantern.',expected:{actor:'i',verb:'have',object:'lantern',quantity:1},exampleId:'confirm-lantern'}
  ],
  success:'You have one lantern for the path and one pear left. Your three statements completed the exchange.'
};
export default starterLanguage;

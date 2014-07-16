/*
    Kongr(空儿), jQuery based placeholder shim.
*/

;(function(Ctor){
    if ( window.define && window.define.amd == true ){
        define(function(){
            return Ctor;
        });
    }
    if ( window.jQuery ) {
        new Ctor(window.jQuery);
    }
})
(function ($) {
    if ( $ == null ) {
        throw new Error('jQuery is not specified');
    }
    if ( $.fn.beam == null ) {
        throw new Error('jQuery.fn.beam is required');
    }

    var KEY_DATA = 'jQuery.fn.kongr.data', propVisitor = $.fn.prop? 'prop': 'attr';
    var KEY_ATTR = 'placeholder';
    var KEY_CLASS_INDEX = '-kongr-index-';
    var $win = $(window);
    var settingsHolder = {};
    var instanceCount = 0;
    var hasPlaceholder = 'placeholder' in document.createElement('input');
    var defaultOptions = {
        className: '-kongr-placeholder-',
        chainUpdate: false,
        autoPosition: true,
        hideOnFocus: false
    };

    // storing all 'data' object, data object contains all element-hover pairs and theirs settings
    var elQueue = [];

    // Get the first stylesheet in the document, or, if there are none, create/inject
    // one and return it.
    function getStyleSheet() {
        var sheet = document.styleSheets && document.styleSheets[0];
        if (! sheet) {
            var head = document.head || document.getElementsByTagName('head')[0];
            var style = document.createElement('style');
            style.appendChild(document.createTextNode(''));
            document.head.appendChild(style);
            sheet = style.sheet;
        }
        return sheet;
    }
        
    // initialize inputs
    function init(i, dom) {

        if ( hasPlaceholder ) {
            return;
        }

        instanceCount++;
        var el = $(dom);
        var tip = el.attr(KEY_ATTR);
        var settings = {};
        var tagName = el[propVisitor]('tagName').toLowerCase();

        $.extend(settings, settingsHolder);

        // if it is not a input or input without title attr, bypass it.
        if  (
                (
                    tagName != 'input' &&
                    tagName != 'textarea'
                ) ||
                tip == null ||
                tip == '' ||
                el.is('[type=hidden]')
            ) {
            return;
        }

        // get rid of title and disable autofill
        el.attr(KEY_ATTR, '').attr('autocomplete','off');

        // create a hover element, and cover the input
        var hover = $('<div></div>')
            .html(tip)
            .addClass(settings.className)
            .addClass(KEY_CLASS_INDEX + instanceCount )
            .appendTo(el.parent());

        // if there are value in it, hide hover
        if (el.val() != ""){
            hover.hide();
        }

        var data = {
            settings: settings,
            input: el,
            hover: hover,
            tip: tip,
            virgin: true,
            index: instanceCount
        };

        elQueue.push(data);

        el.data(KEY_DATA, data);
        hover.data(KEY_DATA, data);

        cloneCss(hover, el);
        hookEvents(el, hover);
    }

    function cloneCss(hover, el){
        var data = el.data(KEY_DATA);

        if ( data.deferRender ) {
            return data.deferRender;
        }

        data.deferRender = $.Deferred();

        (function loop(){

            if ( !el.is(':visible') ) {
                setTimeout( loop, 200 );
                return;
            }

            var size = {
                width: el.width(),
                height: el.height()
            };

            var z = el.css('zIndex');
            z = z == 'auto' ? 0 : z;

            hover.css({
                position: 'absolute',
                // a little bit higher than current element.
                zIndex: z + 1, 
                overflow: 'hidden',
                width: size.width,
                height: size.height,
                paddingTop: el.css('paddingTop'),
                paddingLeft: el.css('paddingLeft'),
                paddingRight: el.css('paddingRight'),
                paddingBottom: el.css('paddingBottom'),
                marginTop: el.css('marginTop'),
                marginLeft: el.css('marginLeft'),
                marginRight: el.css('marginRight'),
                marginBottom: el.css('marginBottom'),
                lineHeight: el.css('lineHeight'),
                cursor: 'text',
                // just in case bastards such as bootstrap set our box-sizing
                boxSizing: 'content-box'
            })
            .beam().to(el).at('center middle');

            getStyleSheet().addRule( '.' + KEY_CLASS_INDEX  + data.index, 'color: #999' );

            data.deferRender.resolve();
            delete data.deferRender;

        })();

        return data.deferRender;

    }

    function findDataTarget(dom, data){
        var el = $(dom);
        var i = elQueue.length;
        while(i--){
            var cursor = elQueue[i];
            if (cursor.input.get(0) == el.get(0)){
                if (data!=null){
                    data.value = cursor;
                }
                return i;
            }
        }
        return -1;
    }

    function clearHover(i, dom){
        var data = {};
        i = findDataTarget(dom, data);
        if (i < 0){
            return;
        }
        data.value.input.attr(KEY_ATTR, data.value.tip).blur();
        data.value.hover.remove();
        elQueue.splice(i, 1);
    }

    function hideHover(i, dom){
        var data = {};
        i = findDataTarget(dom, data);
        if (i < 0){
            return;
        }
        data.value.hover.hide();
    }

    function hookEvents(el, hover) {
        var ieInputEventFixDkey = 'prevText';

        // autocomplete sucks, even we hooked to below events,
        // we still cannot detect value changed by autocomplete feature in all case
        // considering disable it by using autocomplete=off or kick of loop checking textbox value.
        el
            .blur(handleBlur)
            .focus(handleFocus)
            .change(handleChange)
            .bind('input', handleChange)
            .bind('propertychange',(function(callback){
                return function(){
                    var el = $(this);
                    var pt = el.data(ieInputEventFixDkey);
                    el.data(ieInputEventFixDkey, el.val());
                    if (pt !== el.val()){
                        callback.apply(this, arguments);
                    }
                };
            })(handleChange))
            .data(ieInputEventFixDkey, el.val());

        // comment out as jquery will do this for us and this bind may cause incompatibility issue in ie 6
        // .bind('propertychange', handleChange);

        hover.click(handleClick);
    }

    // repositioning hover elemnets when windows resized.
    function handleResize(){

        var i = elQueue.length;
        while(i--){
            var cursor = elQueue[i];
            if (cursor.autoPosition){
                cloneCss(cursor.hover, cursor.input);
            }
        }
    }

    // handle when text blur, try to decide if hover need to be displayed.
    function handleBlur() {
        var self = $(this);
        var data = self.data(KEY_DATA);
        var v = self.val();

        // do we need to check v == data.tip ?
        if (v == null ||
            v == '') {
            data.hover.show();
        }
        else{
            data.hover.hide();
        }
    }

    function handleFocus() {
        var data = $(this).data(KEY_DATA);

        if (data.settings.hideOnFocus){
            data.hover.hide();
        }
    }

    function handleChange(){
        var data = $(this).data(KEY_DATA);

        // if someone touched her.. then we are not going to display
        // the texttip when there is no char in it.
        if (data.input.val() !== false){
            data.virgin = false;
        }

        data.hover.hide();

        // clear hover when autocomplete
        if (data.settings.chainUpdate){
            var i = elQueue.length;
            while(i--){
                if (elQueue[i].input != data.input){
                    handleBlur.call(elQueue[i].input);
                }
            }
        }
    }

    function handleClick(evt) {
        evt.stopPropagation();
        var $el = $(this),
            data = $el.data(KEY_DATA),
            input = data.input;
        
        if (data.settings.hideOnFocus){
            $el.hide();
        }

        input.focus();
        input.click();
    }

    var exports = {
        kongr: function (method, options) {
            if (Object.prototype.toString.call(method) == '[object String]'){
                method = method.toLowerCase();
                switch(method){
                    case 'clear':
                        return this.each(clearHover);
                        break;
                    case 'hide':
                        return this.each(hideHover);
                        break;
                    default:
                        if (options == null){
                            options = {};
                        }
                        options.className = method;
                        break;
                }
            }
            else{
                options = method;
            }
            $.extend(settingsHolder, defaultOptions, options);
            return this.each(init);
        }
    };

    $.fn.extend(exports);
    $win.resize(handleResize);

    return $;
});
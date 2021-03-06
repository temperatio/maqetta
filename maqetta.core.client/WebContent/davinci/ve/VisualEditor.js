define([
    "dojo/_base/declare",
	"dojo/text!davinci/ve/template.html",
	"davinci/Runtime",
	"davinci/Workbench",
	"davinci/model/Path",
	"davinci/ve/Context",
	"davinci/ve/commands/ModifyRuleCommand",
	"preview/silhouetteiframe"
], function(declare, template, Runtime, Workbench, Path, Context, ModifyRuleCommand, SilhouetteIframe){

//davinci.ve.VisualEditor.EDITOR_ID="davinci.ve.HTMLPageEditor";

return declare("davinci.ve.VisualEditor", null, {

	deviceName: 'none',
	_orientation: 'portrait',
	
	constructor: function(element, pageEditor)	{
		this._pageEditor = pageEditor;
		this.contentPane = dijit.getEnclosingWidget(element);
		dojo.addClass(this.contentPane.domNode, "fullPane");
		var content = '<div class="silhouette_div_container">'+
			'<span class="silhouetteiframe_object_container"></span>'+
			'</div>';
		this.contentPane.attr('content', content);
		var silhouette_div_container=dojo.query('.silhouette_div_container',this.contentPane.domNode)[0];
		this.silhouetteiframe = new SilhouetteIframe({
			rootNode:silhouette_div_container,
			margin:20
		});
		
		/* The following code provides a fix for #864: Drag/drop from widget palette
		 * not working if page canvas is scrolled. Possibly because of the funky stuff we do
		 * with width/height being 100% on HTML and BODY, both Mozilla and WebKit set
		 * the BODY height to the size of the IFRAME, and if scrolled, but (invisible)
		 * top of the BODY is shifted up off of the screen and the height of the BODY
		 * is equal to height of IFRAME, which causes an empty area at bottom of canvas
		 * where the browser will not send mouse events. To workaround this problem,
		 * extend the width/height of the BODY to be the size of the surrounding ContentPane
		 * adjusted by the amount the BODY is scrolled.
		 * 
		 * FIXME: This patch probably won't be necessary if we get rid of the "infinite canvas"
		 * and instead force user to pick a fixed-size canvas, in which case things will
		 * work like the mobile silhouettes, which don't have the problem.
		 */
		function resizeBody(bodyElem, size){
			if(bodyElem.scrollLeft > 0){
				bodyElem.style.width= (size.w + bodyElem.scrollLeft) + "px";
			}else{
				bodyElem.style.width = "100%";
			}
			if(bodyElem.scrollTop > 0){
				bodyElem.style.height=(size.h + bodyElem.scrollTop) + "px";
			}else{
				bodyElem.style.height = "100%";
			}
		}
		var visualEditor = this;
		this.contentPane.connect(this.contentPane, 'resize', function(newPos){
			// "this" is the ContentPane dijit
			var iframe = dojo.query('iframe', this.domNode)[0];
			if(iframe && iframe.contentDocument && iframe.contentDocument.body){
				var bodyElem = iframe.contentDocument.body;
				resizeBody(bodyElem, newPos);
				setTimeout(function() { visualEditor.getContext().select(visualEditor.getSelectedWidget()); }, 100); //FIXME: should call updateFocus
				if(!visualEditor._scrollHandler){
					visualEditor._scrollHandler = dojo.connect(iframe.contentDocument, 'onscroll', this, function(e){
						resizeBody(bodyElem, {
							w: dojo.style(this.domNode, 'width'),
							h: dojo.style(this.domNode, 'height')
						});
					});
				}
			}
		});
	},
	
	setDevice: function(deviceName) {
	    this.deviceName = deviceName;
		//FIXME: Path shouldn't be hard-coded
	    var svgfilename = deviceName == 'none' ? null : "app/preview/images/" + deviceName + ".svg";
		this.silhouetteiframe.setSVGFilename(svgfilename);
		this.getContext().setMobileTheme(deviceName);

		// #683 - When using mobile silhouette, add mobile <meta> tags to
		// document.
		this.getContext().setMobileMeta(deviceName);
	},
	
	toggleOrientation: function() {
		if(this.deviceName!='none'){
			//FIXME: Would be better to publish an event about orientation changing
			//and then have the toolbar widget subscribe to it and update the icon
			//But easier said than done because of the way the Workbench works.
			//Current Workbench doesn't support icons that can toggle based on
			//product state.
			var editorRootElement;
			if(this.context && this.context._visualEditor && this.context._visualEditor._pageEditor){
				editorRootElement = this.context._visualEditor._pageEditor._rootElement;
			}
			var rotateIconNode = dojo.query('.rotateIcon',editorRootElement)[0];
			var ccwClass = 'rotateIconCCW';
			if(this._orientation == 'landscape'){
				this._orientation = 'portrait';
				dojo.removeClass(rotateIconNode,ccwClass);
			}else{
				this._orientation = 'landscape';			
				dojo.addClass(rotateIconNode,ccwClass);
			}
			this.silhouetteiframe.setOrientation(this._orientation)	;
		}
	},

	_objectPropertiesChange: function (event){

		if (!this.isActiveEditor()) {
			return;
		}
		var context = this.getContext();
		var command = event.command;	
		command.setContext(context);
		context.getCommandStack().execute(command);
		if(command._newId){
			var widget = davinci.ve.widget.byId(command._newId, context.getDocument());
			context.select(widget);
		}else{
			var selection = context.getSelection();
			var widget = selection.length ? selection[selection.length - 1] : undefined;
			if(selection.length > 1){
				context.select(widget);
			}
		}
		//context.onSelectionChange(context.getSelection());
		this._srcChanged();
	},

	isActiveEditor: function(){
		var currentEditor = Runtime.currentEditor;
		return currentEditor && currentEditor.declaredClass=="davinci.ve.PageEditor" && currentEditor.visualEditor == this;
	},
	
	_stylePropertiesChange: function (value){
		if(!this.isActiveEditor() ){
			return;
		}
		
		var context = this.getContext(),
			selection = context.getSelection(),
			widget = selection.length ? selection[selection.length - 1] : undefined;

		if(selection.length > 1){
			context.select(widget);
		}
		var command = null;
		
		if(value.appliesTo=="inline"){
			var allValues = {};
			/* rewrite any URLs found */
			
			var filePath = new Path(this.fileName);
			
			for(var name in value.values){
				if(davinci.ve.utils.URLRewrite.containsUrl(value.values[name])){
					
					var oldUrl = new Path(davinci.ve.utils.URLRewrite.getUrl(value.values[name]));
					if(!oldUrl.isAbsolute){
						var newUrl = oldUrl.relativeTo(filePath).toString();
						var newValue = davinci.ve.utils.URLRewrite.replaceUrl(value.values[name], newUrl);
						allValues[name]=newValue;
					}else{
						allValues[name]=value.values[name]; //FIXME: combine with below
					}
				}else{
					allValues[name]=value.values[name];
				}
			}
			
			command = new davinci.ve.commands.StyleCommand(widget, allValues, value.applyToWhichStates);	
		}else{
			var rule=null;
			
			// if type=="proposal", the user has chosen a proposed new style rule
			// that has not yet been added to the given css file (right now, app.css)
			if(value.appliesTo.type=="proposal"){

				//FIXME: Not included in Undo logic
				var cssFile = this.context.model.find({elementType:'CSSFile', relativeURL: value.appliesTo.targetFile}, true);
				if(!cssFile){
					console.log("Cascade._changeValue: can't find targetFile");
					return;
				}
				var rule = cssFile.addRule(value.appliesTo.ruleString+" {}");
			}else{
				rule = value.appliesTo.rule;
			}
			
			/* update the rule */
			var command = new ModifyRuleCommand(rule, value.values);
		}
		if(command){
			context.getCommandStack().execute(command);
			if(command._newId){
				var widget = davinci.ve.widget.byId(command._newId, context.getDocument());
				this.context.select(widget);
			}
			
			this._srcChanged();
			dojo.publish("/davinci/ui/widgetValuesChanged",[value]);
		}
	},
	_srcChanged: function(){
		this.isDirty = true;
	},
	
	getContext: function(){
		return this.context;
	},

	getTemplate: function(){
		return template;
	},
	
	destroy: function () {
	    this._handles.forEach(dojo.disconnect);
	    if(this._scrollHandler){
	    	dojo.disconnect(this._scrollHandler);
	    	this._scrollHandler = null;
	    }
	},
	
	setContent: function (fileName, content, newHtmlParams){
		this._onloadMessages=[];	// List of messages to present to user after loading has completed
		this._setContent(fileName, content, newHtmlParams);
	},
	
	saveAs: function (newFileName, oldFileName, content){
		
		this._setContent(newFileName, content);
	},
	
	_setContent: function(filename,content, newHtmlParams){
		
		this._setContentRaw(filename, content, newHtmlParams);
	},
	
	_setContentRaw: function(filename, content, newHtmlParams){
		this.fileName = filename;
		this.basePath = new Path(filename);
	   
		if (!this.initialSet){
			
			var loc = Workbench.location();
			//FIXME: replace this stuff with a regexp
			if (loc.charAt(loc.length-1)=='/'){
				loc=loc.substring(0,loc.length-1);
			}
		   	while(filename.indexOf(".")==0 || filename.indexOf("/")==0){
		   		filename = filename.substring(1,filename.length);
			}				
			var baseUrl=loc+'/user/'+Runtime.userName+'/ws/workspace/'+filename;

			this._handles=[];
			var containerNode = dojo.query('.silhouette_div_container',this.contentPane.domNode)[0];
			this.context = new Context({
				editor: this._pageEditor,
				visualEditor: this,
				containerNode: containerNode,
				model: content,
				baseURL: baseUrl,
				iframeattrs:{'class':'silhouetteiframe_iframe'}
			});

			this.context._commandStack=this._commandStack;
			this._commandStack._context=this.context;
//			this.context.addActionGroup(new davinci.ve.actions.ContextActions());
//			this.context.addActionGroup(new davinci.ve.actions.ChildActions());

			var prefs=davinci.workbench.Preferences.getPreferences('davinci.ve.editorPrefs', Runtime.getProject());
			if (prefs) {
				this.context.setPreferences(prefs);
			}

//			this._handles.push(dojo.connect(this.context, "activate", this, this.update));
			this._handles.push(dojo.connect(this.context, "onContentChange", this,this.onContentChange));
//			this._handles.push(dojo.connect(this.context, "onSelectionChange",this, this.onContentChange));
		
			this.title = dojo.doc.title;

			this.context._setSource(content, dojo.hitch(this, function(){
				this.savePoint = 0;
				this.context.activate();
				var popup = Workbench.createPopup({partID:'davinci.ve.visualEditor',
					domNode: this.context.getContainerNode(), 
					keysDomNode: this.context.getDocument(), context:this.context});
				var context = this.context;
				popup.adjustPosition=function (event) {
					// Adjust for the x/y position of the visual editor's IFRAME relative to the workbench
					// Adjust for the scrolled position of the document in the visual editor, since the popup menu callback assumes (0, 0)
					var coords = dojo.position(context.frameNode);
					dojo.withDoc(context.getDocument(), function(){
						var scroll = dojo.docScroll();
						coords.x -= scroll.x;
						coords.y -= scroll.y;
					});

					return coords;
				};

				// resize kludge to make Dijit visualEditor contents resize
				// seems necessary due to combination of 100%x100% layouts and extraneous width/height measurements serialized in markup
				context.getTopWidgets().forEach(function (widget) { if (widget.resize) { widget.resize(); } });
			}), null, newHtmlParams);
	   		// set flow layout on user prefs
			var flow = this.context.getFlowLayout(); // gets the current layout, but also sets to default if missing..
			this.initialSet=true;
		}else{
			this.context.setSource(content);
		}
		// auto save file
		this.save(true);
	},

	supports: function (something){
		return /^palette|properties|style|states|inline-style|MultiPropTarget$/.test(something);
	},

	//FIXME: pointless. unused? remove?
	getIsDirty: function(){
		var dirty = (this.context.getCurrentPoint() != this.savePoint);
	},

	getSelectedWidget: function(){
		//if(this._selectedWidget)
		//	return this._selectedWidget;
		
		var context = this.getContext(),
			selection = context.getSelection(),
			widget = selection.length ? selection[selection.length - 1] : undefined;

		if(selection.length > 1){
			context.select(widget);
		}
		return widget;
	},

	getSelectedSubWidget: function(){
		return this._selectedSubWidget;
	},

	getDefaultContent: function (){
		return null;
	},

	saved: function(){
		this.save();
	},

	//FIXME
	getFileEditors: function(){
		debugger;
	},
	
	save: function (isAutoSave){
		var model = this.context.getModel();
		model.setDirty(true);
		var visitor = {
			visit: function(node){
				if((node.elementType=="HTMLFile" || node.elementType=="CSSFile") && node.isDirty()){
					node.save(isAutoSave);
				}
				return false;
			}
		};
		
		model.visit(visitor);
		this.isDirty=isAutoSave;
	},
	
	getDefaultContent: function (){
		return this.getTemplate();
	},
	
	previewInBrowser: function(){
		var deviceName = this.deviceName;
		var editor = Workbench.getOpenEditor();
		var fileURL = editor.resourceFile.getURL();
		// FIXME. Phil, is there a URL to the working copy of the current file that we can use
		// Right now I am doing an auto-save which is not right.
		// Either we should prompt user "You must save before you can preview in browser. OK to save?"
		// or we should preview the working copy instead of the permanent file.
		editor.save();
		if(deviceName && deviceName.length && deviceName!='none'){
			var orientation_param = (this._orientation == 'landscape') ? '&orientation='+this._orientation : "";
			fileURL = davinci.Workbench.location()+'?preview=1&device='+encodeURI(deviceName)+'&file='+encodeURI(fileURL)+orientation_param;
		}
		window.open(fileURL);
	}
});
});

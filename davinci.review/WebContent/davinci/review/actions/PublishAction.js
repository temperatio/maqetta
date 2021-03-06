dojo.provide("davinci.review.actions.PublishAction");

dojo.require("davinci.actions.Action");
dojo.require("dojox.grid.DataGrid");
dojo.require("dojo.data.ItemFileWriteStore");
dojo.require("dojox.data.QueryReadStore");
dojo.require("dijit.form.SimpleTextarea");
dojo.require("dijit.form.Textarea");
dojo.require("dijit.form.DropDownButton");
dojo.require("dijit.form.ComboBox");
dojo.require("dojox.widget.Toaster");
dojo.require("dijit.form.DateTextBox");
dojo.require("dijit.form.Form");
dojo.require("dojo.date.locale");
dojo.require("dijit.form.MultiSelect");
dojo.require("davinci.review.model.ReviewFileTreeModel");
dojo.require("dojox.validate.regexp");
dojo.require("davinci.review.widgets.PublishWizard");
dojo.require("dijit.Dialog");

dojo.require("dojo.i18n");  
dojo.requireLocalization("davinci.review.actions", "actions");

dojo.declare("davinci.review.actions.PublishAction", davinci.actions.Action, {
	constructor: function(node,isRestart){
		this.node =  node;
		this.isRestart = isRestart;
		if(node&&node.isRestart)
			this.isRestart = true;
	},
	run : function() {
		var publishWizard = this.publishWizard = new davinci.review.widgets.PublishWizard();
		var langObj = dojo.i18n.getLocalization("davinci.review.actions", "actions");
		this.dialog = new dijit.Dialog( {
			title : langObj.newReview,
			onCancle: dojo.hitch(this,this.close),
			onHide: dojo.hitch(this, this.hide)
		});
		this.dialog.setContent(publishWizard);
		this.dialog.show();
		dojo.connect(publishWizard,"onClose",this,this.close);
		publishWizard.initData(this.node,this.isRestart);
		publishWizard.updateSubmit();
		publishWizard.reviewerStackContainer.resize();
		
	},
	
	hide: function(){
		this.dialog.destroyRecursive();
	},
	
	close: function(){
		this.dialog.hide();
	}
});
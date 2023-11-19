<script>
  import $ from 'jquery'

  import { FileDrop } from '../../../filedrop'

  export default {
    props: {
      files: Array,
      placeholder: String
    },
    mounted: function() {
      this.$nextTick(() => {
        this.initializeFileDrop(
          () => this.$emit('start'),
          (droppedFiles) => this.$emit('change', droppedFiles)
        );
        $('.fd-file', this.$refs.dropZone).on('change', () => {
          var file = $('#file-input input', this.$refs.dropZone)[0].files[0];
          if (file)
            this.importFile(file.nativeFile);
        });
      })
    },
    methods: {
      initializeFileDrop: function(startedCallback, finishedCallback) {
        var uploadOptions = { iframe: { url: '?/upload' }, multiple: true, logging: 0 };
        var uploadArea = new FileDrop(this.$refs.dropZone, uploadOptions);
        uploadArea.event('send', (files) => {
          startedCallback();
          this.importFile(files[0].nativeFile, finishedCallback);
        });
      },
      importFile (file, callback) {
        var reader = new FileReader();
        if (file.name.split('.').last() == 'db') {
          reader.onload = () => callback(reader.result)
          reader.readAsBinaryString(file);
        } else
          callback(false);
      }
    }
  }
</script>

<template>
  <div v-ripple ref="dropZone">
    <div class="dndtxt">
      <slot />
    </div>
  </div>
</template>

<style>
  /***
    Styles below are only required if you're using <iframe> fallback in
    addition to HTML5 drag & drop (only working in Firefox/Chrome/Opera 15+).
    You can @import this file and override individual styles. Drag & drop zone
    can be styled in absolutely any way you want so there are no defaults.
   ***/

  /* Essential FileDrop zone element configuration: */
  .fd-zone {
    position: relative;
    overflow: hidden;
    width: 360px;
    padding: 30px;
    margin: 0 auto;
    text-align: center;
    background: #272727;
    color: rgba(255, 255, 255, 0.9) !important;
    border-radius: 10px;
    border: 4px dotted #333;
    font-size: 1.2em;;
    font-weight: 500;
    text-align: center;
    letter-spacing: 0.0892857143em;
    text-indent: 0.0892857143em;
    text-transform: uppercase;
    transition: background 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0px 3px 1px -2px rgb(0 0 0 / 20%), 0px 2px 2px 0px rgb(0 0 0 / 14%), 0px 1px 5px 0px rgb(0 0 0 / 12%);
  }
  .fd-zone:hover {
    background: #383838 !important;
  }

  .fd-zone form {
    margin-top: -16px;
  }

  .fd-zone .divider {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Hides <input type="file"> while simulating "Browse" button: */
  .fd-file {
    opacity: 0;
    font-size: 118px;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 1;
    padding: 0;
    margin: -31px;
    cursor: pointer;
    filter: alpha(opacity=0);
    font-family: sans-serif;
  }

  /***
    With .over you can provide feedback when user drags a file over the drop zone:
   ***/

  .fd-zone.over { border-color: #444; background: #2d2d2d; }
</style>

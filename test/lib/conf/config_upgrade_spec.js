      describe('and has write permissions', function(){

        it('updates the package');

        describe('and the config file was modified', function(){

          describe('and has no write permissions', function(){

            it('leaves the file untouched');
          })

          describe('and has write permissions', function(){

            it('adds new keys if any');

            it('does not replace any existing values');

            it('updates for existing keys');
          });
        });

        it('exits the program');
      });
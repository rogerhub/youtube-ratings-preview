SOURCES=$(find -type f src)
.PHONY : clean

default: youtube-ratings-preview.xpi

clean:
	rm youtube-ratings-preview.xpi

youtube-ratings-preview.xpi: $(SOURCES)
	make -C src compile

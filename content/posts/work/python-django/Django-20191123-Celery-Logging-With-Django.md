---
title: Django/Celery 프로젝트 Celery에서 Django Logging Module 사용하기
date: "2019-11-23"
template: "post"
draft: false
slug: "/posts/django-celery-celery-logging/"
category: "Framework/Django"
tags:
  - "Django"
  - "Celery"
  - "Python"
  - "Logging"
description: "Django/Celery 프로젝트 Celery에서 Django Logging 모듈 사용하기"
---


## Introduction

일반적으로 Python Django 기반 서비스를 개발할 때, Background Task를 위해 Celery를 많이 사용한다.

Celery에서도 Django와 함께 사용하기 위한 Guide를 제공 하고 있고, Django를 통해서는 Request를 빠르게 처리하고, Celery를 활용하여 Background/Batch 형태의 Task를 처리하는 방식으로 서비스들이 이루어진다. 

Django Application은 Logging 모듈을 쉽게 Config 하여, 다양한 Formatter, Handler, Filter 등을 적용할 수 있다. ([Django Logging 공식문서 참조](https://docs.djangoproject.com/en/2.2/topics/logging/), Django Logging에 대해서는 추후 다시 다룰 예정이다.)

하지만, Django Project의 Logging Configuration은 Celery에는 적용되지 않는다. [Celery Logging 공식문서](https://docs.djangoproject.com/en/2.2/topics/logging/)를 보면, Celery가 실행될 때, 기존에 Configure 되어 있던 Root Logger는 삭제되고, Celery가 자체적으로 설정한 Logger가 적용된다. 

따라서, Django Project를 통해 Config한 Logging 모듈이 Celery에는 적용되지 않으며, Celery에서 Django의 Logging Module을 활용하기 위해서는 약간의 작업(?)이 필요하다.

 
## Django Logging 설정

([Django Logging 공식문서](https://docs.djangoproject.com/en/2.2/topics/logging/)를 바탕으로, 간단히 아래와 같이 Logging을 설정한다.

```python
LOG_LEVEL = 'INFO'
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'default': {
            'format': u'[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s > %(message)s'
        },
    },
    'handlers': {
        'file_handler': {
            'level': LOG_LEVEL,
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'my-logging.log'),
            'maxBytes': 1024 * 1024 * 10,
            'backupCount': 10,
            'formatter': 'default',
        },
        'stream_handler': {
            'level': LOG_LEVEL,
            'class': 'logging.StreamHandler',
            'formatter': 'default',
        },
    },
    'loggers': {
        'stream_logger': {
            'handlers': ['file_handler'],
            'level': LOG_LEVEL,
            'propagate': False
        },
        'file_logger': {
            'handlers': ['stream_handler']
        }
    }
}

```


## Celery에서 Django Logging 사용하기


다시 한번 [Celery Logging 공식문서](https://docs.djangoproject.com/en/2.2/topics/logging/)를 살펴보면, 아래와 같은 내용이 있다.
```
Note : 
Logging can also be customized by connecting to the celery.signals.setup_logging signal.
```

Celery가 실행되어 초기화 될 때 setup_logging 이라는 Signal이 발생되고, 이 Signal에 Handler를 등록하여, Celery에서 사용될 Logging 설정을 적용할 수 있다.
Django의 Logging 모듈은 Python의 공식 Logging 모듈을 사용하기 때문에, Django의 설정을 동일하게 Celery Logging 설정으로 등록할 수 있다.

[Celery의 Django 연동 공식 가이드](https://docs.celeryproject.org/en/latest/django/first-steps-with-django.html)에 따라, 일반적으로 proj/proj/celery.py 파일에서 Celery App을 초기화하게 되고, 여기에 아래와 같은 내용을 적용함으로써, Celery에서 Django Logging 설정을 사용할 수 있다.

```python
from __future__ import absolute_import, unicode_literals

import os
import logging

from celery import Celery
from celery.signals import setup_logging

logger = logging.getLogger()

# set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'my_project.settings')

app = Celery('my_project')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

## Celery에 Django Logging 모듈 적용
@setup_logging.connect
def config_loggers(*args, **kwags):
    from logging.config import dictConfig
    from django.conf import settings
    dictConfig(settings.LOGGING)


# Load task modules from all registered Django app configs.
app.autodiscover_tasks()
```

우선 **celery.signals.setup_logging** 시그널을 import하고, 이 시그널에 대한 핸들러를 등록한다. 

그리고, python logging 모듈의 dictConfig 함수를 활용해, 로깅 설정을 등록한다. 이때 등록되는 설정은 우리 프로젝트의 settings.py에 정의된 Logging 설정이다. 
(django.conf.settings.LOGGING)

이렇게 하여, Celery에서 Django 프로젝트에 정의한 Logging 설정을 동일하게 사용할 수 있다.
